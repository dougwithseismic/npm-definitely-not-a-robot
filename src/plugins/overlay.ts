import { describeValue, HumanError, requireOption } from '../errors'
import { inPage } from '../in-page'
import { isCssColor } from './css-color'
import { definePlugin, type HumanPlugin } from './index'
import { type OverlayParts, overlayInPage } from './overlay-page'

export interface VisibleCursorOptions {
    /** Fill colour of the arrow, any CSS colour. Default `'#111827'`. */
    color?: string
    /** Height of the arrow in pixels. Default `24`. */
    size?: number
    /** Colour of the ring drawn on every press, or `false` for none. Default `'#3b82f6'`. */
    ripple?: string | boolean
}

export interface TrailOptions {
    /** Line colour, any CSS colour. Default `'#ef4444'`. */
    color?: string
    /** Line width in pixels. Default `3`. */
    width?: number
    /** How long each part of the line takes to fade, in ms. Default `1200`. */
    fade?: number
}

function overlayPlugin(name: string, parts: OverlayParts): HumanPlugin {
    // Installs the overlay (or updates its options) in the page and every page after it.
    const source = `(${inPage(overlayInPage)})(${JSON.stringify(parts)})`
    return definePlugin({
        name,
        async setup({ driver }) {
            if (!driver.addScript) {
                throw new HumanError(
                    'UNSUPPORTED_PAGE',
                    `${name}() draws in the page, and the "${driver.name}" driver can't add scripts to it.`,
                    'Give your driver an addScript(source) method that runs the source in the page now and after every navigation.'
                )
            }
            await driver.addScript(source)
        },
    })
}

const COLOR_HINT =
    "Use a colour name like 'tomato', a hex code like '#111827', or rgb(), hsl() or oklch()."
const isPositive = (value: number) => Number.isFinite(value) && value > 0

/**
 * Draws a cursor where the page's mouse is, with a ring on every press, so screenshots and
 * `recordVideo` recordings show what the script is doing. Headless browsers draw no cursor of
 * their own. It follows the page's real pointer events, including Playwright's own `page.click()`,
 * and keeps going across navigations, iframes and dialogs.
 */
export function visibleCursor(options: VisibleCursorOptions = {}): HumanPlugin {
    const { color = '#111827', size = 24, ripple = true } = options
    requireOption(
        isCssColor(color),
        `visibleCursor color must be a CSS colour, but got ${describeValue(color)}.`,
        COLOR_HINT
    )
    requireOption(isPositive(size), 'visibleCursor size must be above 0.', 'Try 24.')
    requireOption(
        typeof ripple === 'boolean' || isCssColor(ripple),
        `visibleCursor ripple must be a CSS colour, true or false, but got ${describeValue(ripple)}.`,
        `${COLOR_HINT} Or false for no ring.`
    )
    return overlayPlugin('visibleCursor', {
        cursor: { color, size, ripple: ripple === true ? '#3b82f6' : ripple },
    })
}

/** Draws the path the mouse took as a line that fades, for seeing and debugging motion. */
export function trail(options: TrailOptions = {}): HumanPlugin {
    const { color = '#ef4444', width = 3, fade = 1200 } = options
    requireOption(
        isCssColor(color),
        `trail color must be a CSS colour, but got ${describeValue(color)}.`,
        COLOR_HINT
    )
    requireOption(isPositive(width), 'trail width must be above 0.', 'Try 3.')
    requireOption(isPositive(fade), 'trail fade must be above 0 ms.', 'Try 1200.')
    return overlayPlugin('trail', { trail: { color, width, fade } })
}
