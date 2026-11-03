import type { Point } from '../geometry'
import { inPage } from '../in-page'
import { caretToEndInPage, hitTestInPage } from './hit-test'
import type { ScrollOffset } from './types'

// What the built-in drivers send into the page. Everything goes through inPage, so a build that
// adds helpers (esbuild's keepNames) can't break it. Wrapped once here, not on every call.

export const hitTest = inPage(hitTestInPage)
export const caretToEnd = inPage(caretToEndInPage)
export const windowSize = inPage(() => ({ width: window.innerWidth, height: window.innerHeight }))
export const scrollOffset = inPage((point: Point | null): ScrollOffset => {
    const root = document.scrollingElement ?? document.documentElement
    // An app shell scrolls an inner box, not the page: find the one under the cursor.
    let el = point ? document.elementFromPoint(point.x, point.y) : null
    for (; el && el !== root && el !== document.body; el = el.parentElement) {
        const { overflowY } = getComputedStyle(el)
        if (/auto|scroll|overlay/.test(overflowY) && el.scrollHeight > el.clientHeight) {
            return {
                x: el.scrollLeft,
                y: el.scrollTop,
                maxX: el.scrollWidth - el.clientWidth,
                maxY: el.scrollHeight - el.clientHeight,
            }
        }
    }
    return {
        x: window.scrollX,
        y: window.scrollY,
        maxX: root.scrollWidth - window.innerWidth,
        maxY: root.scrollHeight - window.innerHeight,
    }
})

export const isFunction = (value: unknown): boolean => typeof value === 'function'

/** Whether an error is Playwright's or Puppeteer's timeout, which both name TimeoutError. */
export const isTimeout = (error: unknown): boolean => (error as Error)?.name === 'TimeoutError'

/** Scripts already added to each page, so every human on a page doesn't add its own copy. */
const added = new WeakMap<object, Set<string>>()

/**
 * Add a plugin's script to a page once. `onNewDocument` covers every frame of every new document.
 * Frames already loaded run it now; one that navigates meanwhile gets the init script instead, so
 * its error is safe to drop.
 */
export async function addScriptOnce(
    page: { frames(): { evaluate(source: string): Promise<unknown> }[] },
    source: string,
    onNewDocument: () => Promise<unknown>
): Promise<void> {
    const scripts = added.get(page) ?? new Set()
    added.set(page, scripts)
    if (scripts.has(source)) return
    scripts.add(source)
    await Promise.all([
        onNewDocument().catch((error: unknown) => {
            scripts.delete(source) // so the plugin's setup can try again
            throw error
        }),
        ...page.frames().map((frame) => frame.evaluate(source).catch(() => {})),
    ])
}
