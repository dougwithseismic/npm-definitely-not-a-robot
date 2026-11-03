import { HumanError } from '../errors'
import type { Box, Point, Size } from '../geometry'
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

// The parts of Playwright we use, described by shape so the library needs no Playwright import
// and works with `playwright`, `playwright-core` and `@playwright/test` alike.

type Evaluate = (fn: (el: any, arg: any) => unknown, arg?: any) => Promise<unknown>

export interface PlaywrightLocatorLike {
    boundingBox(options?: { timeout?: number }): Promise<Box | null>
    waitFor(options?: {
        state?: 'attached' | 'detached' | 'visible' | 'hidden'
        timeout?: number
    }): Promise<void>
    scrollIntoViewIfNeeded(options?: { timeout?: number }): Promise<void>
    count(): Promise<number>
    first(): PlaywrightLocatorLike
    evaluate: Evaluate
}

export interface PlaywrightElementHandleLike {
    boundingBox(): Promise<Box | null>
    waitForElementState(state: 'visible', options?: { timeout?: number }): Promise<void>
    scrollIntoViewIfNeeded(options?: { timeout?: number }): Promise<void>
    evaluate: Evaluate
}

export interface PlaywrightPageLike {
    mouse: {
        move(x: number, y: number, options?: { steps?: number }): Promise<void>
        down(options?: { button?: MouseButton; clickCount?: number }): Promise<void>
        up(options?: { button?: MouseButton; clickCount?: number }): Promise<void>
        wheel(deltaX: number, deltaY: number): Promise<void>
    }
    keyboard: {
        down(key: string): Promise<void>
        up(key: string): Promise<void>
        insertText(text: string): Promise<void>
    }
    locator(selector: string): PlaywrightLocatorLike
    viewportSize(): Size | null
    evaluate(fn: any, arg?: any): Promise<any>
    addInitScript(script: { content: string }): Promise<unknown>
    context(): unknown
    frames(): Pick<PlaywrightPageLike, 'evaluate'>[]
}

export function isPlaywrightPage(value: unknown): value is PlaywrightPageLike {
    const page = value as Partial<PlaywrightPageLike> | null
    return (
        !!page &&
        isFunction(page.locator) &&
        isFunction(page.viewportSize) &&
        isFunction(page.context) &&
        isFunction(page.mouse?.move) &&
        isFunction(page.keyboard?.insertText)
    )
}

const isLocator = (value: unknown): value is PlaywrightLocatorLike => {
    const v = value as Partial<PlaywrightLocatorLike> | null
    return !!v && isFunction(v.boundingBox) && isFunction(v.waitFor) && isFunction(v.first)
}

const isElementHandle = (value: unknown): value is PlaywrightElementHandleLike => {
    const v = value as Partial<PlaywrightElementHandleLike> | null
    return !!v && isFunction(v.boundingBox) && isFunction(v.waitForElementState)
}

/**
 * Playwright's wait, the way the driver contract wants it: false on timeout, and our own error
 * for a locator that matches several elements, which Playwright reports only as message text.
 */
function visibleWithin(wait: Promise<void>, description: string): Promise<boolean> {
    return wait.then(
        () => true,
        (error: unknown) => {
            if (isTimeout(error)) return false
            const message = String((error as Error)?.message)
            if (!message.includes('strict mode violation')) throw error
            const count = /resolved to (\d+) elements/.exec(message)?.[1] ?? 'several'
            throw new HumanError(
                'TARGET_AMBIGUOUS',
                `${description} matches ${count} elements, so it's unclear which one to use.`,
                'Make the locator more specific (add { name } or { exact: true }), or pick one with .first() or .nth(i).'
            )
        }
    )
}

function elementRef(
    target: PlaywrightLocatorLike | PlaywrightElementHandleLike,
    description: string,
    box: () => Promise<Box | null>,
    wait: (timeout: number) => Promise<void>,
    exists: () => Promise<boolean>
): ElementRef {
    return {
        description,
        waitForVisible: (timeout) => visibleWithin(wait(timeout), description),
        exists,
        box,
        scrollIntoView: () => target.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {}),
        hitTest: async (point, box) => (await target.evaluate(hitTest, { point, box })) as HitTest,
        caretToEnd: () => target.evaluate(caretToEnd) as Promise<string | undefined>,
    }
}

const locatorRef = (locator: PlaywrightLocatorLike, description: string): ElementRef =>
    elementRef(
        locator,
        description,
        () => locator.boundingBox({ timeout: 1000 }).catch(() => null),
        (timeout) => locator.waitFor({ state: 'visible', timeout }),
        async () => (await locator.count()) > 0
    )

const handleRef = (handle: PlaywrightElementHandleLike): ElementRef =>
    elementRef(
        handle,
        'the element handle',
        () => handle.boundingBox().catch(() => null),
        (timeout) => handle.waitForElementState('visible', { timeout }),
        async () => true
    )

/** The built-in driver for Playwright pages. `createHuman` picks it automatically. */
export function playwrightDriver(page: PlaywrightPageLike): Driver {
    return {
        name: 'playwright',
        // Playwright sends input in the order it's called, so moves needn't wait for each other.
        maxInFlight: 8,
        moveMouse: (x, y) => page.mouse.move(x, y),
        mouseDown: (button, clickCount) => page.mouse.down({ button, clickCount }),
        mouseUp: (button, clickCount) => page.mouse.up({ button, clickCount }),
        wheel: (dx, dy) => page.mouse.wheel(dx, dy),
        keyDown: (key) => page.keyboard.down(key),
        keyUp: (key) => page.keyboard.up(key),
        insertText: (text) => page.keyboard.insertText(text),
        async viewport() {
            return page.viewportSize() ?? ((await page.evaluate(windowSize)) as Size)
        },
        async scrollOffset(at?: Point) {
            return (await page.evaluate(scrollOffset, at ?? null)) as ScrollOffset
        },
        locate(target) {
            if (typeof target === 'string')
                return locatorRef(page.locator(target).first(), `"${target}"`)
            if (isLocator(target)) return locatorRef(target, String(target))
            if (isElementHandle(target)) return handleRef(target)
            return null
        },
        addScript: (source) =>
            addScriptOnce(page, source, () => page.addInitScript({ content: source })),
    }
}
