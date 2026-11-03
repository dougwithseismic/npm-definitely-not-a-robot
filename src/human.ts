import { isPlaywrightPage, type PlaywrightPageLike, playwrightDriver } from './drivers/playwright'
import type { Driver, ElementRef, HitTest, MouseButton } from './drivers/types'
import { describeValue, HumanError, requireOption } from './errors'
import {
    type Box,
    boxCenter,
    isInside,
    type Point,
    pickSpot,
    placeInBox,
    type Size,
    type TimedPoint,
} from './geometry'
import { type BezierMotionOptions, bezierMotion, type MotionStrategy } from './motion'
import type { Action, HumanPlugin, PluginContext } from './plugins'
import { defaultTiming, type Preset, type PresetName, presets, type Timing } from './presets'
import { createRandom, randomSeed, streamSeed } from './random'
import { type ScrollStrategy, type WheelScrollOptions, wheelScroll } from './scroll'
import { type NaturalTypingOptions, naturalTyping, needsShift, type TypingStrategy } from './typing'

/** An element: a selector string, or a Playwright locator or element handle. */
export type ElementTarget = string | { boundingBox(): Promise<unknown> }

/** Something to aim at: an element, or a point in viewport pixels. */
export type Target = ElementTarget | Point

export interface HumanOptions extends Preset {
    /**
     * A named preset (`'average'`, `'careful'`, `'fast'`, or `'demo'` for recordings, which also
     * draws the cursor) or your own. Default `'average'`.
     */
    preset?: PresetName | Preset
    /** Replay identical paths and timings. Default: a random seed, readable as `human.seed`. */
    seed?: number
    /**
     * Multiplies every timing. `2` is twice as fast; `'instant'` skips all waiting (for CI).
     * The `DNAR_SPEED` environment variable overrides this. Default 1.
     */
    speed?: number | 'instant'
    /** How long to wait for a target to appear, in ms. Default 10000. */
    timeout?: number
    /** Where the cursor starts. Default: a random spot in the lower middle of the viewport. */
    startPosition?: Point
    /** Use your own driver instead of detecting Playwright. */
    driver?: Driver
}

export interface MoveOptions {
    /** Override the human's timeout for this action, in ms. */
    timeout?: number
    /** Skip the check that nothing is covering the target. */
    force?: boolean
}

export interface ClickOptions extends MoveOptions {
    button?: MouseButton
    /** 2 for a double-click. Default 1. */
    clickCount?: number
}

export interface TypeOptions extends MoveOptions {
    /** Select everything in the field and delete it before typing. Otherwise the text is added at the end. */
    clear?: boolean
}

export type ScrollOptions = (
    | { by: number | { x?: number; y?: number } }
    | { to: ElementTarget | 'top' | 'bottom' }
) & { timeout?: number }

export interface Human<P = unknown> {
    /** The page this human drives. */
    readonly page: P
    /** The seed in use. Pass it as `{ seed }` to replay this run exactly. */
    readonly seed: number
    /** Where the cursor is, or null before the first action. */
    readonly position: Point | null
    /** Move along a curved path to the target. Resolves with the point it landed on. */
    move(target: Target, options?: MoveOptions): Promise<Point>
    /** Move to the target and linger, so hover menus and tooltips open. */
    hover(target: Target, options?: MoveOptions): Promise<Point>
    /** Move, hesitate, press, hold, release. */
    click(target: Target, options?: ClickOptions): Promise<Point>
    doubleClick(target: Target, options?: Omit<ClickOptions, 'clickCount'>): Promise<Point>
    /** Press on `from`, carry it along a human path, release on `to`. */
    drag(from: Target, to: Target, options?: MoveOptions): Promise<void>
    /** Type into whatever has focus. */
    type(text: string): Promise<void>
    /** Click the target, then type into it. */
    type(target: Target, text: string, options?: TypeOptions): Promise<void>
    /** Press a key or a combination: `'Enter'`, `'Shift+Tab'`, `'ControlOrMeta+A'`. */
    press(keys: string): Promise<void>
    /** Scroll with the mouse wheel by a distance, to an element, or to the top or bottom. */
    scroll(options: ScrollOptions): Promise<void>
    /**
     * Wait like a person thinking. No arguments uses the preset's think time. Skipped when speed
     * is `'instant'`, so wait for the page with Playwright (`expect`, `waitFor`), not with this.
     */
    pause(ms?: number): Promise<void>
    pause(min: number, max: number): Promise<void>
}

const DEFAULT_TIMEOUT = 10_000
/** Pixels kept clear of the viewport edges when aiming. */
const EDGE = 4

const isPoint = (value: unknown): value is Point =>
    !!value &&
    typeof value === 'object' &&
    typeof (value as Point).x === 'number' &&
    typeof (value as Point).y === 'number' &&
    !('boundingBox' in value)

/** Named keys such as `Enter`, `ArrowLeft`, `F5`, `ControlOrMeta`. */
const isKeyName = (key: string): boolean => key.length > 1 && /^[A-Za-z][A-Za-z0-9]*$/.test(key)

const hasPlan = (value: unknown): boolean =>
    !!value && typeof (value as { plan?: unknown }).plan === 'function'

const isOptionsObject = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value) && !hasPlan(value)

/** Merge options objects all the way down, so `{ fitts: { b } }` keeps the preset's `a`. */
function mergeOptions(base: object, over: object): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(over)) {
        if (value === undefined) continue
        const current = merged[key]
        merged[key] =
            isOptionsObject(current) && isOptionsObject(value)
                ? mergeOptions(current, value)
                : value
    }
    return merged
}

/** Merge a preset's strategy setting with the user's: options objects merge, strategies replace. */
function pickStrategy<S, O extends object>(
    fromPreset: S | O | undefined,
    fromUser: S | O | undefined,
    make: (options: O) => S
): S {
    if (hasPlan(fromUser)) return fromUser as S
    if (hasPlan(fromPreset) && fromUser === undefined) return fromPreset as S
    const base = hasPlan(fromPreset) ? {} : (fromPreset ?? {})
    return make(mergeOptions(base, fromUser ?? {}) as O)
}

function readTimeout(value: number | undefined, fallback: number): number {
    if (value === undefined) return fallback
    requireOption(
        Number.isFinite(value) && value > 0,
        `timeout: ${value} isn't a valid timeout.`,
        'Use a number of milliseconds above 0, such as 5000.'
    )
    return value
}

function readSpeed(option: number | 'instant' | undefined): number {
    const fromEnv = typeof process !== 'undefined' ? process.env?.DNAR_SPEED : undefined
    const raw = fromEnv?.trim() || option
    if (raw === undefined) return 1
    if (raw === 'instant') return Number.POSITIVE_INFINITY
    const value = Number(raw)
    requireOption(
        value > 0,
        `${fromEnv ? `DNAR_SPEED=${fromEnv}` : `speed: ${JSON.stringify(option)}`} isn't a valid speed.`,
        "Use a number above 0 (2 is twice as fast) or 'instant'."
    )
    return value
}

function detectDriver(page: unknown): Driver {
    if (isPlaywrightPage(page)) return playwrightDriver(page)
    const looksLike = page as { newPage?: unknown; then?: unknown } | null
    let got = describeValue(page)
    let hint =
        'Pass the page from `await browser.newPage()` or the `page` test fixture. For another tool, write a driver with defineDriver() and pass it as { driver }.'
    if (looksLike && typeof looksLike.then === 'function') {
        got = 'a Promise'
        hint = 'Did you forget `await`? createHuman(await browser.newPage())'
    } else if (looksLike && typeof looksLike.newPage === 'function') {
        got = 'a Browser or BrowserContext'
        hint = 'Call `.newPage()` on it and pass the page.'
    }
    throw new HumanError(
        'UNSUPPORTED_PAGE',
        `createHuman() needs a Playwright page, but got ${got}.`,
        hint
    )
}

type Runner = <T>(action: Action, body: () => Promise<T>) => Promise<T>

/**
 * Wrap a page so every action looks like a person did it.
 *
 * @example
 * const human = createHuman(page)
 * await human.click('text=Sign up')
 * await human.type('#email', 'ada@example.com')
 */
export function createHuman<P extends PlaywrightPageLike>(page: P, options?: HumanOptions): Human<P>
/** Wrap anything your own driver can drive. */
export function createHuman<P>(page: P, options: HumanOptions & { driver: Driver }): Human<P>
export function createHuman<P>(page: P, options: HumanOptions = {}): Human<P> {
    const driver = options.driver ?? detectDriver(page)
    const preset: Preset =
        typeof options.preset === 'object' ? options.preset : presets[options.preset ?? 'average']
    requireOption(
        preset,
        `Unknown preset ${JSON.stringify(options.preset)}.`,
        `Use one of: ${Object.keys(presets).join(', ')}, or pass your own preset object.`
    )

    const motion = pickStrategy<MotionStrategy, BezierMotionOptions>(
        preset.motion,
        options.motion,
        bezierMotion
    )
    const typing = pickStrategy<TypingStrategy, NaturalTypingOptions>(
        preset.typing,
        options.typing,
        naturalTyping
    )
    const scrolling = pickStrategy<ScrollStrategy, WheelScrollOptions>(
        preset.scroll,
        options.scroll,
        wheelScroll
    )
    const timing: Timing = { ...defaultTiming, ...preset.timing, ...options.timing }
    // Your plugins run after the preset's, and one with the same name replaces the preset's, so
    // { preset: 'demo', plugins: [visibleCursor({ color })] } restyles the demo cursor.
    const ownPlugins = options.plugins ?? []
    const plugins: HumanPlugin[] = [
        ...(preset.plugins ?? []).filter((p) => !ownPlugins.some((own) => own.name === p.name)),
        ...ownPlugins,
    ]
    const speed = readSpeed(options.speed)
    const instant = speed === Number.POSITIVE_INFINITY
    const defaultTimeout = readTimeout(options.timeout, DEFAULT_TIMEOUT)
    const seed = options.seed ?? randomSeed()
    // Each action draws from its own stream of the seed, so a retry in one action (a slow page, a
    // cover that takes a while to go) can't change what the actions after it do.
    let actions = 0
    let random = createRandom(streamSeed(seed, 1))

    let position: Point | null = null
    let queue: Promise<unknown> = Promise.resolve()
    let ready: Promise<void> | undefined

    // ---- time ----

    const realSleep = (ms: number) =>
        ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
    /** Wait a human-scale duration, scaled by speed. */
    const wait = (ms: number) => (instant ? Promise.resolve() : realSleep(ms / speed))
    const between = ([min, max]: [number, number]) => random.range(min, max)

    // ---- low-level playback ----

    async function ensurePosition(): Promise<Point> {
        if (position) return position
        const viewport = await driver.viewport()
        position = options.startPosition ?? {
            x: Math.round(viewport.width * random.range(0.35, 0.65)),
            y: Math.round(viewport.height * random.range(0.55, 0.85)),
        }
        await driver.moveMouse(position.x, position.y)
        return position
    }

    /** Send planned points on an absolute clock, dropping points rather than drifting late. */
    async function playPath(points: TimedPoint[]): Promise<void> {
        const start = performance.now()
        for (let i = 0; i < points.length; i++) {
            const point = points[i] as TimedPoint
            if (!instant) {
                const next = points[i + 1]
                const now = performance.now()
                if (next && now > start + next.t / speed) continue
                await realSleep(start + point.t / speed - now)
            }
            await driver.moveMouse(point.x, point.y)
            position = { x: point.x, y: point.y }
            for (const plugin of plugins) plugin.onMove?.(position, context)
        }
    }

    /** Press and release one key. `autoShift` holds Shift for capitals and symbols. */
    async function pressKey(char: string, hold: number, autoShift = true): Promise<void> {
        const key = char === '\n' ? 'Enter' : char
        // Text with no key on a US keyboard (emoji, accents, tabs, which would move focus) arrives
        // as an input event instead.
        if (!isKeyName(key) && !(key.length === 1 && key >= ' ' && key <= '~')) {
            await driver.insertText(key)
            return
        }
        const shift = autoShift && needsShift(key)
        if (shift) {
            await driver.keyDown('Shift')
            await wait(random.range(20, 60))
        }
        await driver.keyDown(key)
        await wait(hold)
        await driver.keyUp(key)
        if (shift) {
            await wait(random.range(10, 40))
            await driver.keyUp('Shift')
        }
    }

    // ---- finding targets ----

    async function settle(ref: ElementRef): Promise<Box | null> {
        // Smooth scrolling and animations keep moving the box; wait until it holds still.
        let last = await ref.box()
        for (let i = 0; i < 20; i++) {
            await realSleep(50)
            const box = await ref.box()
            if (
                !box ||
                !last ||
                (box.x === last.x &&
                    box.y === last.y &&
                    box.width === last.width &&
                    box.height === last.height)
            ) {
                return box
            }
            last = box
        }
        return last
    }

    /** How much of [start, start + size) shows between the edges of a viewport `length` long. */
    const shown = (start: number, size: number, length: number) =>
        Math.min(start + size, length - EDGE) - Math.max(start, EDGE)
    /** Enough of it must show to aim at comfortably. */
    const enough = (shownPx: number, size: number) => shownPx >= Math.min(size, 8)

    function visiblePart(box: Box, viewport: Size): Box | null {
        const width = shown(box.x, box.width, viewport.width)
        const height = shown(box.y, box.height, viewport.height)
        if (!enough(width, box.width) || !enough(height, box.height)) return null
        return { x: Math.max(box.x, EDGE), y: Math.max(box.y, EDGE), width, height }
    }

    async function playWheel(dx: number, dy: number): Promise<void> {
        for (const step of scrolling.plan({ dx, dy, random })) {
            await wait(step.delay)
            await driver.wheel(step.dx, step.dy)
        }
    }

    /** Scroll with the wheel until the element shows, falling back to an instant scroll. */
    async function bringIntoView(ref: ElementRef, viewport: Size): Promise<Box | null> {
        let box = await ref.box()
        for (let attempt = 0; attempt < 6 && box; attempt++) {
            if (visiblePart(box, viewport)) return box
            await ensurePosition()
            // Wheel each axis that doesn't show enough, bringing the centre to a comfortable spot.
            const center = boxCenter(box)
            const dy = enough(shown(box.y, box.height, viewport.height), box.height)
                ? 0
                : center.y - viewport.height * random.range(0.35, 0.55)
            const dx = enough(shown(box.x, box.width, viewport.width), box.width)
                ? 0
                : center.x - viewport.width / 2
            await playWheel(dx, dy)
            const after = await settle(ref)
            // The wheel scrolled something else (or nothing): stop and use the fallback.
            if (!after || (after.x === box.x && after.y === box.y)) break
            box = after
        }
        if (box && visiblePart(box, viewport)) return box
        await ref.scrollIntoView()
        return settle(ref)
    }

    async function waitVisible(ref: ElementRef, timeout: number): Promise<void> {
        if (await ref.waitForVisible(timeout)) return
        if (await ref.exists().catch(() => false)) {
            throw new HumanError(
                'TARGET_NOT_VISIBLE',
                `Found ${ref.description} but it never became visible (waited ${timeout}ms).`,
                'It may be hidden, zero-sized or inside a closed menu. Open its parent first, for example with human.hover().'
            )
        }
        throw new HumanError(
            'TARGET_NOT_FOUND',
            `Couldn't find ${ref.description} on the page (waited ${timeout}ms).`,
            'Check the selector in DevTools, or wait for the page to load first: await page.waitForLoadState().'
        )
    }

    /** Turn a target into an element and wait for it to show. */
    async function findElement(
        target: unknown,
        verb: string,
        timeout: number,
        hint: string
    ): Promise<ElementRef> {
        const ref = driver.locate(target)
        if (!ref) {
            throw new HumanError(
                'UNSUPPORTED_TARGET',
                `Can't ${verb} ${describeValue(target)}.`,
                hint
            )
        }
        await waitVisible(ref, timeout)
        return ref
    }

    interface Aim {
        point: Point
        size: number
        ref?: ElementRef
    }

    async function aim(target: Target, opts: MoveOptions = {}, verb = 'move to'): Promise<Aim> {
        if (isPoint(target)) return { point: { x: target.x, y: target.y }, size: 20 }
        const timeout = readTimeout(opts.timeout, defaultTimeout)
        const deadline = Date.now() + timeout
        const ref = await findElement(
            target,
            verb,
            timeout,
            "A target is a selector ('#email'), a locator (page.getByRole('button')), an element handle, or a point ({ x: 100, y: 200 })."
        )
        const viewport = await driver.viewport()
        let box = await bringIntoView(ref, viewport)
        // One draw per aim: how often the loop below retries depends on the clock, and a seed
        // must replay the same way however long the page took.
        const spot = pickSpot(random)
        let last: HitTest | undefined
        let scrolledInside = false
        while (true) {
            const visible = box ? visiblePart(box, viewport) : null
            if (box && visible) {
                const point = placeInBox(visible, spot)
                last = await ref.hitTest(point, box)
                // `force` goes ahead when something covers the target, never when it's clipped:
                // then the press would land on whatever the panel or frame shows instead.
                if (last.ok || (opts.force && !last.clipped)) {
                    return { point, size: Math.min(visible.width, visible.height), ref }
                }
                if (last.clipped && !scrolledInside) {
                    // Scrolled out of sight inside a panel or a frame, which the page wheel
                    // doesn't reach. Scroll it into place, then aim again.
                    scrolledInside = true
                    await ref.scrollIntoView()
                    box = await settle(ref)
                    continue
                }
            }
            if (Date.now() > deadline) break
            await realSleep(100)
            box = await ref.box()
        }
        if (last?.covering && !last.clipped) {
            throw new HumanError(
                'TARGET_COVERED',
                `Can't ${verb} ${ref.description}: ${last.covering} is on top of it.`,
                'Close or dismiss whatever is covering it first, or pass { force: true } to go ahead anyway.'
            )
        }
        throw new HumanError(
            'TARGET_NOT_VISIBLE',
            last?.clipped
                ? `${ref.description} stays hidden inside a scrolling panel or frame (waited ${timeout}ms).`
                : `Couldn't bring ${ref.description} into view (waited ${timeout}ms).`,
            last?.clipped
                ? 'Scroll the panel to it first, for example with human.scroll({ to: ... }) on an element near it.'
                : 'It may be off-screen behind a fixed layout, or moving too fast to aim at.'
        )
    }

    /** Travel along a planned path to an aimed point. */
    const travel = (from: Point, to: Aim) =>
        playPath(motion.plan({ from, to: to.point, targetSize: to.size, random }))

    async function moveTo(target: Target, opts: MoveOptions = {}, verb?: string): Promise<Aim> {
        const from = await ensurePosition()
        const aimed = await aim(target, opts, verb)
        await travel(from, aimed)
        // If the element moved while we travelled (layout shift, animation), aim again and
        // correct course, with the same visibility and cover checks as the first time.
        if (aimed.ref) {
            const box = await aimed.ref.box()
            if (box && !isInside(aimed.point, box)) {
                const again = await aim(target, opts, verb)
                await travel(aimed.point, again)
                return again
            }
        }
        return aimed
    }

    async function clickAt(target: Target, opts: ClickOptions = {}): Promise<Aim> {
        const aimed = await moveTo(target, opts, 'click')
        const button = opts.button ?? 'left'
        const count = opts.clickCount ?? 1
        await wait(between(timing.hesitation))
        for (let i = 1; i <= count; i++) {
            await driver.mouseDown(button, i)
            await wait(between(timing.clickHold))
            await driver.mouseUp(button, i)
            if (i < count) await wait(between(timing.doubleClickGap))
        }
        return aimed
    }

    async function pressCombo(keys: string): Promise<void> {
        // Split the way Playwright does: a '+' that starts a key is the plus key, so '+' and
        // 'Control++' both work and 'Control+' doesn't.
        const parts: string[] = []
        let building = ''
        for (const char of typeof keys === 'string' ? keys : '') {
            if (char === '+' && building) {
                parts.push(building)
                building = ''
            } else {
                building += char
            }
        }
        parts.push(building)
        requireOption(
            !parts.includes(''),
            `Can't press ${JSON.stringify(keys)}.`,
            "Name a key, or keys joined by +: 'Enter', 'Shift+Tab', 'ControlOrMeta+A'."
        )
        const key = parts.pop() as string
        for (const modifier of parts) {
            await driver.keyDown(modifier)
            await wait(random.range(30, 80))
        }
        // In a combination 'A' means the A key, as in Playwright, so don't add Shift.
        await pressKey(key, between(timing.clickHold), false)
        for (const modifier of parts.reverse()) {
            await wait(random.range(15, 50))
            await driver.keyUp(modifier)
        }
    }

    async function typeText(text: string): Promise<void> {
        // Windows line endings would press Enter twice.
        for (const stroke of typing.plan({ text: text.replace(/\r\n?/g, '\n'), random })) {
            await wait(stroke.delay)
            await pressKey(stroke.key, stroke.hold)
        }
    }

    async function scrollTo(opts: ScrollOptions): Promise<void> {
        const at = await ensurePosition()
        if ('by' in opts) {
            const by = typeof opts.by === 'number' ? { y: opts.by } : opts.by
            await playWheel(by.x ?? 0, by.y ?? 0)
            return
        }
        if (opts.to === 'top' || opts.to === 'bottom') {
            // Measure what the wheel scrolls under the cursor: the page, or an app's main panel.
            let offset = await driver.scrollOffset(at)
            for (let i = 0; i < 20; i++) {
                const dy = opts.to === 'top' ? -offset.y : offset.maxY - offset.y
                if (Math.abs(dy) < 2) return
                await playWheel(0, dy)
                await realSleep(instant ? 50 : 120)
                const after = await driver.scrollOffset(at)
                if (after.y === offset.y) return
                offset = after
            }
            return
        }
        const ref = await findElement(
            opts.to,
            'scroll to',
            readTimeout(opts.timeout, defaultTimeout),
            "Scroll to a selector ('#pricing'), a locator, an element handle, 'top' or 'bottom'."
        )
        await bringIntoView(ref, await driver.viewport())
    }

    // ---- public API ----

    const setupPlugins = async () => {
        for (const plugin of plugins) await plugin.setup?.(context)
    }

    /** Actions run one at a time, in the order they were called, even without await. */
    const queued: Runner = (action, body) => {
        const task = queue.then(async () => {
            random = createRandom(streamSeed(seed, ++actions))
            // A failed setup is retried on the next action instead of failing every one after it.
            ready ??= setupPlugins().catch((error) => {
                ready = undefined
                throw error
            })
            await ready
            for (const plugin of plugins) await plugin.beforeAction?.(action, context)
            const result = await body()
            for (const plugin of plugins) await plugin.afterAction?.(action, context)
            return result
        })
        queue = task.catch(() => {})
        return task
    }

    const build = (run: Runner): Human<P> => ({
        page,
        seed,
        get position() {
            return position ? { ...position } : null
        },
        move: (target, opts) =>
            run({ type: 'move', target }, async () => (await moveTo(target, opts)).point),
        hover: (target, opts) =>
            run({ type: 'hover', target }, async () => {
                const { point } = await moveTo(target, opts, 'hover over')
                await wait(between(timing.hoverDwell))
                return point
            }),
        click: (target, opts) =>
            run({ type: 'click', target }, async () => (await clickAt(target, opts)).point),
        doubleClick: (target, opts) =>
            run(
                { type: 'click', target },
                async () => (await clickAt(target, { ...opts, clickCount: 2 })).point
            ),
        drag: (from, to, opts) =>
            run({ type: 'drag', target: from }, async () => {
                const start = await moveTo(from, opts, 'drag')
                await wait(between(timing.hesitation))
                await driver.mouseDown('left', 1)
                await wait(random.range(80, 200))
                // What's being dragged may cover the drop target, so skip the cover check.
                await travel(start.point, await aim(to, { ...opts, force: true }, 'drop on'))
                await wait(random.range(60, 150))
                await driver.mouseUp('left', 1)
            }),
        type: ((a: Target, b?: string, opts?: TypeOptions) => {
            const [target, text] = b === undefined ? [undefined, a] : [a, b]
            return run({ type: 'type', target, text: text as string }, async () => {
                requireOption(
                    typeof text === 'string',
                    `type() needs text to type, but got ${describeValue(text)}.`,
                    "Pass the target and the text: human.type('#email', 'ada@example.com'), or just the text to type into whatever has focus."
                )
                if (target === undefined) return typeText(text)
                const { ref } = await clickAt(target, opts)
                if (opts?.clear) {
                    await wait(between(timing.hesitation))
                    await pressCombo('ControlOrMeta+A')
                    await wait(random.range(60, 160))
                    await pressKey('Backspace', between(timing.clickHold))
                } else {
                    // The click left the caret wherever it landed; add the text at the end.
                    await ref?.caretToEnd()
                }
                await wait(between(timing.hesitation))
                await typeText(text)
            })
        }) as Human<P>['type'],
        press: (keys) => run({ type: 'press', text: keys }, () => pressCombo(keys)),
        scroll: (opts) => run({ type: 'scroll' }, () => scrollTo(opts)),
        pause: (min?: number, max?: number) =>
            run({ type: 'pause' }, () => {
                if (min === undefined) return wait(between(timing.think))
                return wait(max === undefined ? min : random.range(min, max))
            }),
    })

    const human = build(queued)
    // Plugins get a human that acts at once, outside the queue and without hooks, so a hook that
    // moves the mouse doesn't wait behind its own action or set off the hooks again.
    const context: PluginContext = {
        human: build((_action, body) => body()) as Human,
        driver,
        // Plugins draw from a stream of their own, so they can't shift what the actions do.
        random: createRandom(streamSeed(seed, 0)),
    }
    return human
}
