import type { Box, Point } from '../geometry'
import type { HitTest } from './types'

/**
 * Runs inside the page (or the frame that holds `el`). Checks that the topmost element at the
 * point is `el` or inside it, looking through shadow roots and treating a `<label>` for `el` as a
 * hit. When it isn't, says whether `el` is clipped (scrolled out of a panel or its frame) or
 * covered. Kept free of outside references because it's serialised and sent to the browser.
 *
 * `point` and `box` are in top-level viewport pixels. The point's offset into the box, added to
 * the element's own rect, gives the point in this frame's pixels, which is the same thing in the
 * top-level page and the right thing inside an iframe.
 */
export function hitTestInPage(el: Element, { point, box }: { point: Point; box: Box }): HitTest {
    const up = (node: Node): Element | null =>
        node.parentElement ?? (node.parentNode as ShadowRoot | null)?.host ?? null
    const rect = el.getBoundingClientRect()
    const x = rect.x + point.x - box.x
    const y = rect.y + point.y - box.y

    let hit = document.elementFromPoint(x, y)
    while (hit?.shadowRoot) {
        const inner = hit.shadowRoot.elementFromPoint(x, y)
        if (!inner || inner === hit) break
        hit = inner
    }
    if (hit) {
        for (let node: Element | null = hit; node; node = up(node)) {
            if (node === el) return { ok: true }
        }
        const label = hit.closest('label')
        if (label && (label as HTMLLabelElement).control === el) return { ok: true }
    }

    // Missed. If the point is outside what the element's scrolling ancestors and frame show, the
    // element is clipped rather than covered.
    let left = 0
    let top = 0
    let right = window.innerWidth
    let bottom = window.innerHeight
    for (
        let node = up(el);
        node && node !== document.body && node !== document.documentElement;
        node = up(node)
    ) {
        const style = getComputedStyle(node)
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
        const r = node.getBoundingClientRect()
        left = Math.max(left, r.left + node.clientLeft)
        top = Math.max(top, r.top + node.clientTop)
        right = Math.min(right, r.left + node.clientLeft + node.clientWidth)
        bottom = Math.min(bottom, r.top + node.clientTop + node.clientHeight)
    }
    if (x < left || x >= right || y < top || y >= bottom) return { ok: false, clipped: true }
    if (!hit) return { ok: false, covering: 'nothing (the point is outside the page)' }
    const id = hit.id ? `#${hit.id}` : ''
    const cls =
        typeof hit.className === 'string' && hit.className.trim()
            ? `.${hit.className.trim().split(/\s+/).slice(0, 2).join('.')}`
            : ''
    return { ok: false, covering: `${hit.tagName.toLowerCase()}${id}${cls}` }
}

/**
 * Runs inside the page. Puts the caret after the last character of a text field. Email and number
 * fields with text in them need a key press to get there: it selects their text and returns the
 * key, for the caller to press straight away.
 */
export function caretToEndInPage(el: Element): string | undefined {
    const field = el as HTMLInputElement
    if (typeof field.value === 'string' && typeof field.setSelectionRange === 'function') {
        try {
            field.setSelectionRange(field.value.length, field.value.length)
        } catch {
            // These refuse setSelectionRange but allow select(), and the right arrow then leaves the
            // caret at the end on every platform. (End scrolls the page on a Mac.)
            if ((field.type === 'email' || field.type === 'number') && field.value !== '') {
                field.select()
                return 'ArrowRight'
            }
        }
    } else if ((el as HTMLElement).isContentEditable) {
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
    }
    return undefined
}
