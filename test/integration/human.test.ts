import { describe, expect, it } from 'vitest'
import {
    bezierMotion,
    createHuman,
    defineMotion,
    definePlugin,
    defineScroll,
    HumanError,
    playwrightDriver,
    trackpadScroll,
} from '../../src'
import { events, failure, moveTrace, useFixture } from './fixture'

const fx = useFixture()

const box = async (selector: string) => (await fx.page.locator(selector).boundingBox())!
const inside = (
    p: { x: number; y: number },
    b: { x: number; y: number; width: number; height: number }
) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height

describe('clicking', () => {
    it('travels a curved path and clicks inside the target', async () => {
        const human = createHuman(fx.page, { speed: 3, seed: 1, startPosition: { x: 100, y: 700 } })
        const point = await human.click('#signup')
        const log = await events(fx.page)
        const moves = log.filter((e) => e.type === 'mousemove')
        const down = log.find((e) => e.type === 'mousedown')!
        const click = log.find((e) => e.type === 'click')!

        expect(moves.length).toBeGreaterThan(10)
        expect(inside(down, await box('#signup'))).toBe(true)
        expect(click.target).toBe('signup')
        expect(point).toEqual({ x: down.x, y: down.y })
        expect(human.position).toEqual(point)

        // Not a straight line: some point strays well off the chord.
        const a = moves[0]!
        const b = moves.at(-1)!
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        const maxDev = Math.max(
            ...moves.map(
                (p) => Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / len
            )
        )
        expect(maxDev).toBeGreaterThan(5)
    })

    // A browser that answers each move slowly (WebKit, or one far away) still gets the path, since
    // moves don't wait for each other's answers. `lag` adds a delay to every answer.
    it.each([0, 40])(
        'gets at least 4 in 5 of the planned points to the page, with %i ms added',
        async (lag) => {
            let planned = 0
            const bezier = bezierMotion()
            const motion = defineMotion({
                name: 'counted',
                plan(request) {
                    const points = bezier.plan(request)
                    planned += points.length
                    return points
                },
            })
            const base = playwrightDriver(fx.page)
            const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
            const driver = {
                ...base,
                moveMouse: (x: number, y: number) => sleep(lag).then(() => base.moveMouse(x, y)),
            }
            const human = createHuman(fx.page, {
                motion,
                driver,
                seed: 1,
                startPosition: { x: 100, y: 700 },
            })
            await human.move({ x: 900, y: 150 })
            const received = (await events(fx.page)).filter((e) => e.type === 'mousemove').length
            expect(received).toBeGreaterThanOrEqual(planned * 0.8)
        }
    )

    it('accepts Playwright locators and points', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.click(fx.page.getByRole('button', { name: 'Sign up' }))
        const b = await box('#email')
        await human.click({ x: b.x + 10, y: b.y + 10 })
        const clicks = (await events(fx.page))
            .filter((e) => e.type === 'click')
            .map((e) => e.target)
        expect(clicks).toEqual(['signup', 'email'])
    })

    it('double-clicks and right-clicks', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.doubleClick('#signup')
        await human.click('#signup', { button: 'right' })
        const log = await events(fx.page)
        expect(log.some((e) => e.type === 'dblclick')).toBe(true)
        expect(log.some((e) => e.type === 'contextmenu' && e.button === 2)).toBe(true)
    })

    it('waits for elements that appear later', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.click('#late')
        expect((await events(fx.page)).some((e) => e.type === 'click' && e.target === 'late')).toBe(
            true
        )
    })

    it('refuses to click through something covering the target, unless forced', async () => {
        const human = createHuman(fx.page, { speed: 'instant', timeout: 400 })
        const error = await failure(human.click('#covered'))
        expect(error).toBeInstanceOf(HumanError)
        expect(error.code).toBe('TARGET_COVERED')
        expect(error.message).toContain('div#overlay.cookie-banner')
        expect(error.message).toContain('force: true')

        await human.click('#covered', { force: true })
        const click = (await events(fx.page)).find((e) => e.type === 'click')!
        expect(click.target).toBe('overlay')
    })

    it('says clearly when a target is missing or hidden', async () => {
        const human = createHuman(fx.page, { speed: 'instant', timeout: 300 })
        const missing = await failure(human.click('#nope'))
        expect(missing.code).toBe('TARGET_NOT_FOUND')
        expect(missing.message).toContain('"#nope"')
        const hidden = await failure(human.click('#hidden'))
        expect(hidden.code).toBe('TARGET_NOT_VISIBLE')
    })
})

describe('hovering and dragging', () => {
    it('opens a hover menu and clicks inside it', async () => {
        const human = createHuman(fx.page, { speed: 4 })
        await human.hover('#menu')
        expect(await fx.page.locator('#menu-item').isVisible()).toBe(true)
        await human.click('#menu-item')
        expect(
            (await events(fx.page)).some((e) => e.type === 'click' && e.target === 'menu-item')
        ).toBe(true)
    })

    it('drags and drops at human speed', async () => {
        const human = createHuman(fx.page, { speed: 4 })
        await human.drag('#source', '#dropzone')
        expect(
            await fx.page.evaluate(() => (window as unknown as { dropped?: boolean }).dropped)
        ).toBe(true)
    })

    // Real-time playback skips points that are already late, so how many arrive at human speed
    // depends on how busy the machine is. Instant mode thins paths, but not while a button is
    // held, so there every point of the drag arrives.
    it('sends every point of a drag in instant mode', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.drag('#source', '#dropzone')
        expect(
            await fx.page.evaluate(() => (window as unknown as { dropped?: boolean }).dropped)
        ).toBe(true)
        const log = await events(fx.page)
        const held = log.slice(
            log.findIndex((e) => e.type === 'mousedown'),
            log.findIndex((e) => e.type === 'mouseup')
        )
        expect(held.filter((e) => e.type === 'mousemove').length).toBeGreaterThan(15)
    })
})

describe('typing', () => {
    const value = (selector: string) => fx.page.locator(selector).inputValue()

    it('types exactly, with one key press per character and an uneven rhythm', async () => {
        const human = createHuman(fx.page, { speed: 3, seed: 3 })
        const text = 'Ada Lovelace! (1815) ok?'
        await human.type('#email', text)
        expect(await value('#email')).toBe(text)

        const downs = (await events(fx.page)).filter(
            (e) => e.type === 'keydown' && e.key !== 'Shift'
        )
        expect(downs.map((e) => e.key).join('')).toBe(text)
        const gaps = downs.slice(1).map((e, i) => Math.round(e.t - downs[i]!.t))
        expect(new Set(gaps).size).toBeGreaterThan(8)
        // Capitals and symbols are typed with Shift held, like a real keyboard.
        expect(downs.find((e) => e.key === 'A')?.shift).toBe(true)
    })

    it('still ends with the right text when making typos', async () => {
        const human = createHuman(fx.page, { speed: 'instant', seed: 8, typing: { typos: 0.25 } })
        const text = 'the quick brown fox jumps over the lazy dog'
        await human.type('#email', text)
        expect(await value('#email')).toBe(text)
        expect((await events(fx.page)).some((e) => e.key === 'Backspace')).toBe(true)
    })

    it('clears a field first when asked', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.type('#prefilled', 'new value', { clear: true })
        expect(await value('#prefilled')).toBe('new value')
    })

    it('handles new lines, accents and emoji', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.type('#notes', 'café 🤖\nline two')
        expect(await value('#notes')).toBe('café 🤖\nline two')
    })

    it('types into the focused element and presses key combos', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.click('#email')
        await human.type('hello')
        await human.press('ControlOrMeta+A')
        await human.press('Backspace')
        await human.type('bye')
        expect(await value('#email')).toBe('bye')
    })
})

describe('scrolling', () => {
    const scrollY = () => fx.page.evaluate(() => window.scrollY)

    it('scrolls by a distance with several wheel events', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.scroll({ by: 1200 })
        await fx.page.waitForTimeout(300)
        expect(await scrollY()).toBeGreaterThan(1000)
        expect((await events(fx.page)).filter((e) => e.type === 'wheel').length).toBeGreaterThan(5)
    })

    it('merges wheel notches into a few events in instant mode', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.scroll({ by: 2000 })
        await fx.page.waitForTimeout(300)
        expect(await scrollY()).toBeGreaterThan(1800)
        expect(
            (await events(fx.page)).filter((e) => e.type === 'wheel').length
        ).toBeLessThanOrEqual(8)
    })

    it('scrolls to the bottom and back to the top', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        await human.scroll({ to: 'bottom' })
        expect(await scrollY()).toBeGreaterThan(2000)
        await human.scroll({ to: 'top' })
        expect(await scrollY()).toBe(0)
    })

    it('glides in many small steps with trackpad scrolling, the demo preset’s', async () => {
        const human = createHuman(fx.page, { preset: 'demo', seed: 2 })
        await human.scroll({ by: 600 })
        await expect.poll(scrollY).toBeGreaterThan(500)
        // The wheel would send 6. Steps that fall behind the clock go together, so allow for a
        // busy machine.
        const wheels = (await events(fx.page)).filter((e) => e.type === 'wheel')
        expect(wheels.length).toBeGreaterThan(8)
    })

    it('still covers the whole distance, on time, when the browser answers slowly', async () => {
        const base = playwrightDriver(fx.page)
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
        const slow = {
            ...base,
            wheel: (dx: number, dy: number) => sleep(30).then(() => base.wheel(dx, dy)),
        }
        // Note how long the plan takes, to compare with how long scrolling took.
        let planned = 0
        const trackpad = trackpadScroll()
        const scroll = defineScroll({
            name: 'noted',
            plan(request) {
                const steps = trackpad.plan(request)
                planned = steps.reduce((total, step) => total + step.delay, 0)
                return steps
            },
        })
        const human = createHuman(fx.page, { driver: slow, scroll, seed: 2 })
        const started = performance.now()
        await human.scroll({ by: 600 })
        const took = performance.now() - started
        await expect.poll(async () => Math.abs((await scrollY()) - 600)).toBeLessThan(5)
        // Waiting 30 ms on each of its dozens of steps would make it about a second late.
        expect(took).toBeLessThan(planned + 400)
    })

    it('wheels an off-screen target into view before clicking it', async () => {
        const human = createHuman(fx.page, { speed: 4 })
        await human.click('#far')
        const log = await events(fx.page)
        expect(log.filter((e) => e.type === 'wheel').length).toBeGreaterThan(3)
        expect(log.some((e) => e.type === 'click' && e.target === 'far')).toBe(true)
    })
})

describe('the factory', () => {
    it('replays identical movement for the same seed', async () => {
        const run = () =>
            moveTrace(fx.browser, async (p) => {
                const human = createHuman(p, { seed: 1234, speed: 'instant' })
                await human.click('#signup')
                await human.click('#email')
            })
        expect(await run()).toEqual(await run())
    })

    it('exposes a random seed when none is given', () => {
        const a = createHuman(fx.page)
        const b = createHuman(fx.page)
        expect(typeof a.seed).toBe('number')
        expect(a.seed).not.toBe(b.seed)
    })

    it('keeps each human’s cursor to itself', async () => {
        const a = createHuman(fx.page, { speed: 'instant', startPosition: { x: 10, y: 10 } })
        const b = createHuman(fx.page, { speed: 'instant', startPosition: { x: 1000, y: 700 } })
        await a.move('#signup')
        expect(b.position).toBeNull()
        await b.move({ x: 900, y: 600 })
        expect(a.position).not.toEqual(b.position)
    })

    it('runs actions in order even without await', async () => {
        const human = createHuman(fx.page, { speed: 'instant' })
        void human.click('#email')
        void human.type('first ')
        await human.type('second')
        expect(await fx.page.locator('#email').inputValue()).toBe('first second')
    })

    it('finishes fast in instant mode and honours DNAR_SPEED', async () => {
        const started = Date.now()
        await createHuman(fx.page, { speed: 'instant' }).type('#email', 'quick in CI')
        expect(Date.now() - started).toBeLessThan(2500)

        process.env.DNAR_SPEED = 'instant'
        try {
            const t0 = Date.now()
            await createHuman(fx.page, { speed: 0.5 }).type('#notes', 'env wins')
            expect(Date.now() - t0).toBeLessThan(2500)
        } finally {
            delete process.env.DNAR_SPEED
        }
    })

    it('sends a few points per movement in instant mode, not one round trip per point', async () => {
        const human = createHuman(fx.page, { speed: 'instant', startPosition: { x: 20, y: 20 } })
        const landed = await human.move({ x: 1100, y: 600 })
        const moves = (await events(fx.page)).filter((e) => e.type === 'mousemove')
        expect(moves.length).toBeLessThanOrEqual(9) // the start, then 8 along the way
        expect(moves.at(-1)).toMatchObject(landed)
    })

    it('calls plugin hooks', async () => {
        const calls: string[] = []
        let moves = 0
        const spy = definePlugin({
            name: 'spy',
            setup: () => void calls.push('setup'),
            beforeAction: (a) => void calls.push(`before:${a.type}`),
            afterAction: (a) => void calls.push(`after:${a.type}`),
            onMove: () => void moves++,
        })
        const human = createHuman(fx.page, { speed: 'instant', plugins: [spy] })
        await human.click('#signup')
        await human.press('Tab')
        expect(calls).toEqual([
            'setup',
            'before:click',
            'after:click',
            'before:press',
            'after:press',
        ])
        expect(moves).toBeGreaterThan(5)
    })

    it('explains what went wrong when given the wrong thing', async () => {
        const wrong = (value: unknown) => {
            try {
                createHuman(value as never)
            } catch (error) {
                return error as HumanError
            }
            throw new Error('expected an error')
        }
        expect(wrong(fx.browser).code).toBe('UNSUPPORTED_PAGE')
        expect(wrong(fx.browser).message).toContain('got a Browser or BrowserContext')
        expect(wrong(Promise.resolve(fx.page)).message).toContain('forget `await`')
        expect(wrong({}).message).toContain('defineDriver')
        expect(() => createHuman(fx.page, { speed: -1 })).toThrow(/valid speed/)
        expect(() => createHuman(fx.page, { preset: 'turbo' as never })).toThrow(/Unknown preset/)
        const driver = { ...playwrightDriver(fx.page), maxInFlight: Number.NaN }
        expect(() => createHuman(fx.page, { driver })).toThrow(/maxInFlight/)
    })
})
