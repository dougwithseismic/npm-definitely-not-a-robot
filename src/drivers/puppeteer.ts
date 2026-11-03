import { HumanError } from '../errors'
import type { Box, Point, Size } from '../geometry'
import { inPage } from '../in-page'
import {
    addScriptOnce,
    caretToEnd,
    hitTest,
    isFunction,
    isTimeout,
    scrollOffset,
    windowSize,
} from './common'
import type { Driver, ElementRef, HitTest, MouseButton, ScrollOffset } from './types'

// The parts of Puppeteer we use, described by shape like the Playwright driver, so `puppeteer`,
// `puppeteer-core` and the tools built on them all work without a Puppeteer import.

export interface PuppeteerElementHandleLike {
    boundingBox(): Promise<Box | null>
    isVisible(): Promise<boolean>
    scrollIntoView(): Promise<void>
    evaluate(fn: (el: any, arg: any) => unknown, arg?: any): Promise<unknown>
    dispose(): Promise<void>
}

export interface PuppeteerPageLike {
    mouse: {
        move(x: number, y: number): Promise<void>
        // Puppeteer takes clickCount on down and up, though its types leave it out.
        down(options?: { button?: MouseButton; clickCount?: number }): Promise<void>
        up(options?: { button?: MouseButton; clickCount?: number }): Promise<void>
        wheel(options?: { deltaX?: number; deltaY?: number }): Promise<void>
    }
    keyboard: {
        down(key: string, options?: { commands?: string[] }): Promise<void>
        up(key: string): Promise<void>
        sendCharacter(text: string): Promise<void>
    }
    $(selector: string): Promise<PuppeteerElementHandleLike | null>
    waitForSelector(
        selector: string,
        options?: { visible?: boolean; timeout?: number }
    ): Promise<{ dispose(): Promise<void> } | null>
    viewport(): Size | null
    evaluate(fn: any, ...args: any[]): Promise<any>
    evaluateOnNewDocument(source: string): Promise<unknown>
    frames(): { evaluate(source: string): Promise<unknown> }[]
}

export function isPuppeteerPage(value: unknown): value is PuppeteerPageLike {
    const page = value as Partial<PuppeteerPageLike> | null
    return (
        !!page &&
        isFunction(page.$) &&
        isFunction(page.viewport) &&
        isFunction(page.evaluateOnNewDocument) &&
        isFunction(page.mouse?.move) &&
        isFunction(page.keyboard?.sendCharacter)
    )
}

const isElementHandle = (value: unknown): value is PuppeteerElementHandleLike => {
    const v = value as Partial<PuppeteerElementHandleLike> | null
    return (
        !!v && isFunction(v.boundingBox) && isFunction(v.isVisible) && isFunction(v.scrollIntoView)
    )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** Let go of a handle without waiting: nothing depends on it being gone. */
const release = (el: { dispose(): Promise<void> } | null | undefined) => {
    void el?.dispose().catch(() => {})
}

/** The parts of an ElementRef that act on the element once it's in hand. */
function actions(
    withElement: <T>(use: (el: PuppeteerElementHandleLike) => Promise<T>) => Promise<T>
) {
    return {
        box: () => withElement((el) => el.boundingBox()).catch(() => null),
        scrollIntoView: () => withElement((el) => el.scrollIntoView()).catch(() => {}),
        hitTest: (point: Point, box: Box) =>
            withElement((el) => el.evaluate(hitTest, { point, box })) as Promise<HitTest>,
        caretToEnd: () =>
            withElement((el) => el.evaluate(caretToEnd)) as Promise<string | undefined>,
    }
}

/**
 * A selector, looked up again on every use as a Playwright locator is, so an element the page
 * re-renders is still found.
 */
function selectorRef(page: PuppeteerPageLike, selector: string): ElementRef {
    const description = `"${selector}"`
    return {
        description,
        waitForVisible: (timeout) =>
            page.waitForSelector(selector, { visible: true, timeout }).then(
                (el) => {
                    release(el)
                    return true
                },
                (error: unknown) => {
                    if (isTimeout(error)) return false
                    throw error
                }
            ),
        async exists() {
            const el = await page.$(selector)
            release(el)
            return !!el
        },
        ...actions(async (use) => {
            const el = await page.$(selector)
            if (!el) {
                throw new HumanError(
                    'TARGET_NOT_FOUND',
                    `${description} left the page while it was being used.`,
                    'Wait for the page to settle before acting on it.'
                )
            }
            try {
                return await use(el)
            } finally {
                release(el)
            }
        }),
    }
}

/** An element handle. Puppeteer has no wait for a handle to show, so this checks every 100ms. */
function handleRef(handle: PuppeteerElementHandleLike): ElementRef {
    return {
        description: 'the element handle',
        async waitForVisible(timeout) {
            const end = Date.now() + timeout
            while (!(await handle.isVisible())) {
                if (Date.now() >= end) return false
                await sleep(100)
            }
            return true
        },
        // A handle to an element the page has since removed is reported as not found.
        exists: () => handle.evaluate(isConnected).then(Boolean),
        ...actions((use) => use(handle)),
    }
}

const isConnected = inPage((el: Element) => el.isConnected)
const isMac = inPage(() => /Mac|iPhone|iPad/.test(navigator.platform))

/**
 * Chromium on a Mac runs an editing shortcut only when told which command the key means. Playwright
 * does this; Puppeteer leaves it to the caller. These are the ones Playwright maps.
 */
const macCommands: Record<string, string> = {
    'Meta+A': 'selectAll',
    'Meta+C': 'copy',
    'Meta+V': 'paste',
    'Meta+X': 'cut',
    'Meta+Z': 'undo',
    'Shift+Meta+Z': 'redo',
}
const modifiers = ['Alt', 'Control', 'Shift', 'Meta']

/**
 * The built-in driver for Puppeteer pages. `createHuman` picks it automatically. Targets are CSS
 * selectors (and Puppeteer's own, like `::-p-text(Sign up)`) or element handles.
 */
export function puppeteerDriver(page: PuppeteerPageLike): Driver {
    let mac: Promise<boolean> | undefined
    const onMac = (): Promise<boolean> => {
        // Asked once per page, and again if the page was navigating when asked.
        mac ??= page.evaluate(isMac).catch((error: unknown) => {
            mac = undefined
            throw error
        })
        return mac
    }
    // Playwright's ControlOrMeta, which Puppeteer doesn't know: Meta on a Mac, else Control.
    const key = async (name: string) =>
        name === 'ControlOrMeta' ? ((await onMac()) ? 'Meta' : 'Control') : name
    const held = new Set<string>()
    const commandsFor = async (name: string): Promise<string[] | undefined> => {
        const combo = [...modifiers.filter((m) => held.has(m)), name.toUpperCase()].join('+')
        const command = macCommands[combo]
        return command && (await onMac()) ? [command] : undefined
    }
    return {
        name: 'puppeteer',
        // Puppeteer sends input in the order it's called, so moves needn't wait for each other.
        maxInFlight: 8,
        moveMouse: (x, y) => page.mouse.move(x, y),
        mouseDown: (button, clickCount) => page.mouse.down({ button, clickCount }),
        mouseUp: (button, clickCount) => page.mouse.up({ button, clickCount }),
        wheel: (deltaX, deltaY) => page.mouse.wheel({ deltaX, deltaY }),
        async keyDown(name) {
            const resolved = await key(name)
            if (modifiers.includes(resolved)) held.add(resolved)
            const commands = await commandsFor(resolved)
            await page.keyboard.down(resolved, commands && { commands })
        },
        async keyUp(name) {
            const resolved = await key(name)
            held.delete(resolved)
            await page.keyboard.up(resolved)
        },
        insertText: (text) => page.keyboard.sendCharacter(text),
        async viewport() {
            return page.viewport() ?? ((await page.evaluate(windowSize)) as Size)
        },
        async scrollOffset(at?: Point) {
            return (await page.evaluate(scrollOffset, at ?? null)) as ScrollOffset
        },
        locate(target) {
            if (typeof target === 'string') return selectorRef(page, target)
            if (isElementHandle(target)) return handleRef(target)
            return null
        },
        addScript: (source) =>
            addScriptOnce(page, source, () => page.evaluateOnNewDocument(source)),
    }
}
