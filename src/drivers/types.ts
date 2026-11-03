import type { Box, Point, Size } from '../geometry'

export type MouseButton = 'left' | 'right' | 'middle'

export interface ScrollOffset {
    x: number
    y: number
    maxX: number
    maxY: number
}

/** What a driver found under a point when checking a click will land on its target. */
export interface HitTest {
    /** True when the topmost element at the point is the target or inside it. */
    ok: boolean
    /** A short description of what's on top instead, such as `div.cookie-banner`. */
    covering?: string
    /** True when the point is outside what the target's scrolling panels or frame show. */
    clipped?: boolean
    /**
     * When clipped by a panel that scrolls with the wheel, or by its frame: the area they show,
     * in top-level viewport pixels, including any part off screen. The mouse moves over it and
     * turns the wheel there. Without it, a clipped target is scrolled into view instantly.
     */
    clip?: Box
}

/** An element the driver can measure and bring into view. */
export interface ElementRef {
    /** How to name this element in error messages. */
    readonly description: string
    /**
     * Wait until it's visible. Resolves false if `timeout` ms pass first; rejects only for other
     * problems (a broken selector, a locator that matches several elements).
     */
    waitForVisible(timeout: number): Promise<boolean>
    /** Whether anything matches at all (used to choose between "not found" and "not visible"). */
    exists(): Promise<boolean>
    /** Its box in viewport pixels, or null when it isn't rendered. */
    box(): Promise<Box | null>
    /** Scroll it into view without animation. A fallback after human scrolling. */
    scrollIntoView(): Promise<void>
    /**
     * Check that a click at `point` would hit this element and not something covering it. `box`
     * is the element's box as just measured, both in top-level viewport pixels.
     */
    hitTest(point: Point, box: Box): Promise<HitTest>
    /**
     * Put the caret at the end of a text field, so typing adds to what's there. Resolves to a key
     * to press straight away when the field needs one to finish the job (email and number inputs
     * with text in them), or to nothing.
     */
    caretToEnd(): Promise<string | undefined> | Promise<void>
}

/**
 * A driver adapts one automation library to the few low-level operations the library needs.
 * Everything human-like is built on top of these.
 */
export interface Driver {
    readonly name: string
    moveMouse(x: number, y: number): Promise<void>
    mouseDown(button: MouseButton, clickCount: number): Promise<void>
    mouseUp(button: MouseButton, clickCount: number): Promise<void>
    wheel(dx: number, dy: number): Promise<void>
    /**
     * Press a key: a single character (`'a'`, `'A'`) or a key name as Playwright names them
     * (`'Enter'`, `'Shift'`). That includes `'ControlOrMeta'`, which the driver resolves to Meta on
     * a Mac and Control elsewhere.
     */
    keyDown(key: string): Promise<void>
    keyUp(key: string): Promise<void>
    /** Insert text that has no key on a US keyboard (emoji, accents) as an input event. */
    insertText(text: string): Promise<void>
    viewport(): Promise<Size>
    /**
     * The scroll position of what the wheel would scroll at `at` (the nearest scrollable box under
     * that point, else the page), and how far it can scroll.
     */
    scrollOffset(at?: Point): Promise<ScrollOffset>
    /** Turn a user-supplied target into an element, or return null if this driver can't. */
    locate(target: unknown): ElementRef | null
    /**
     * Run a script in the page now and after every navigation. Used by plugins. Every human on a
     * page asks for its plugins' scripts, so the same source can arrive more than once; running it
     * again must be harmless (the built-in driver adds each source once per page).
     */
    addScript?(source: string): Promise<void>
}

/** Identity helper so TypeScript checks and autocompletes a custom driver. */
export const defineDriver = <T extends Driver>(driver: T): T => driver
