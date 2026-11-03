import type { TimedPoint } from '../geometry'

/** What the overlay draws, and how. Both parts share one overlay per page. */
export interface OverlayParts {
    cursor?: { color: string; size: number; ripple: string | false }
    trail?: { color: string; width: number; fade: number }
}

/** What the overlay is showing, for tests and debugging. */
export interface OverlayState {
    x: number | null
    y: number | null
    visible: boolean
    pressed: boolean
    ripples: number
    trail: number
}

/**
 * Runs in the page, in every frame, as soon as it's added and again on every new document. Draws
 * a cursor (and optionally a fading trail) at the position of the page's own pointer events, so
 * the picture is exactly what the page received. Kept free of outside references because it's
 * serialised and sent to the browser.
 *
 * - Built with DOM calls and inline styles only, so it works under a strict Content Security
 *   Policy, inside a closed shadow root so page CSS can't reach it, and ignored by clicks.
 * - Shown in the top layer (as a manual popover) and raised again when a dialog opens above it.
 * - Frames don't draw: they pass their pointer events up a private channel to the top page, which
 *   adds the frame's offset and scale, so the cursor keeps moving over iframes, including ones
 *   inside open shadow roots and ones scaled with CSS.
 * - Survives `document.open()` (Playwright's `setContent`) by re-attaching, and starts each new
 *   page of the same site where the last one left off.
 * - Running it again on the same page only updates the options.
 */
export function overlayInPage(parts: OverlayParts): void {
    const KEY = Symbol.for('definitely-not-a-robot.overlay')
    const STORE = 'definitely-not-a-robot.cursor'
    const w = window as any
    if (w[KEY]) {
        w[KEY].enable(parts)
        return
    }
    const doc = document

    /** Listen on the window, and again after `document.open()` drops every listener. */
    const listen = (handlers: [string, (e: any) => void][], mount = () => {}) => {
        const attach = () => {
            // Adding the same listener twice is a no-op.
            for (const [type, fn] of handlers) {
                w.addEventListener(type, fn, { capture: true, passive: true })
            }
            mount()
        }
        new MutationObserver(attach).observe(doc, { childList: true })
        attach()
    }

    /** The frame elements in `root`, looking inside open shadow roots too. */
    const framesIn = (root: Document | ShadowRoot): HTMLElement[] =>
        Array.from(root.querySelectorAll<HTMLElement>('*')).flatMap((el) => [
            ...(el.tagName === 'IFRAME' || el.tagName === 'FRAME' ? [el] : []),
            ...(el.shadowRoot ? framesIn(el.shadowRoot) : []),
        ])

    /**
     * Pointer events from child frames. Each child says hello once with a private line and sends
     * its moves down that, so the page's own message handlers never see them.
     */
    const fromFrames =
        (pass: (type: string, x: number, y: number) => void) => (e: MessageEvent) => {
            const line = e.ports[0]
            if (e.data?.__dnar !== 'hello' || !line) return
            // Handlers added after ours don't see the hello either.
            e.stopImmediatePropagation()
            const child = e.source
            let from: HTMLElement | undefined
            let edge = { x: 0, y: 0 }
            let walked = Number.NEGATIVE_INFINITY
            line.onmessage = ({ data }) => {
                if (!from?.isConnected) {
                    const isChild = (f: HTMLElement) =>
                        (f as HTMLIFrameElement).contentWindow === child
                    from = Array.from(doc.querySelectorAll<HTMLElement>('iframe, frame')).find(
                        isChild
                    )
                    // Walking every shadow root is slower: only when the plain search misses, and
                    // at most once a second for a frame that can't be found (in a closed root).
                    if (!from && performance.now() - walked > 1000) {
                        walked = performance.now()
                        from = framesIn(doc).find(isChild)
                    }
                    if (!from) return
                    const css = getComputedStyle(from)
                    edge = {
                        x: from.clientLeft + Number.parseFloat(css.paddingLeft),
                        y: from.clientTop + Number.parseFloat(css.paddingTop),
                    }
                }
                const rect = from.getBoundingClientRect()
                // A frame scaled with CSS shows each of its pixels bigger or smaller.
                const sx = from.offsetWidth ? rect.width / from.offsetWidth : 1
                const sy = from.offsetHeight ? rect.height / from.offsetHeight : 1
                pass(
                    data[0],
                    rect.left + (edge.x + data[1]) * sx,
                    rect.top + (edge.y + data[2]) * sy
                )
            }
        }

    if (w !== w.top) {
        // Frames pass their pointer events, and their own children's, up to their parent.
        let up: MessagePort | null = null
        const pass = (type: string, x: number, y: number) => {
            if (!up) {
                const channel = new MessageChannel()
                up = channel.port1
                w.parent.postMessage({ __dnar: 'hello' }, '*', [channel.port2])
            }
            up.postMessage([type, x, y])
        }
        const onPointer = (e: PointerEvent) => pass(e.type, e.clientX, e.clientY)
        Object.defineProperty(w, KEY, { value: { enable: () => {} } })
        listen([
            ['pointermove', onPointer],
            ['pointerdown', onPointer],
            ['pointerup', onPointer],
            ['message', fromFrames(pass)],
        ])
        return
    }

    const opts: OverlayParts = {}
    let x: number | null = null
    let y: number | null = null
    let pressed = false
    let ripples = 0
    const points: TimedPoint[] = []
    let drawing = 0

    const styled = <E extends Element>(el: E, props: Record<string, string>): E => {
        for (const [name, value] of Object.entries(props)) {
            ;(el as unknown as HTMLElement).style.setProperty(name, value, 'important')
        }
        return el
    }

    // Page CSS reaches the host but nothing inside its closed shadow root, so only the host needs
    // resetting. What's inside inherits pointer-events and visibility from it.
    const host = styled(doc.createElement('dnar-overlay'), {
        display: 'block',
        position: 'fixed',
        inset: '0',
        width: 'auto',
        height: 'auto',
        margin: '0',
        padding: '0',
        border: '0',
        background: 'transparent',
        overflow: 'visible',
        transform: 'none',
        'z-index': '2147483647',
        'pointer-events': 'none',
        opacity: '1',
        visibility: 'visible',
        filter: 'none',
        'clip-path': 'none',
        'max-width': 'none',
        'max-height': 'none',
        'min-width': '0',
        'min-height': '0',
    })
    host.setAttribute('popover', 'manual')
    host.setAttribute('aria-hidden', 'true')
    const root = host.attachShadow({ mode: 'closed' })

    const canvas = styled(doc.createElement('canvas'), {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        display: 'none',
    })
    const ctx = canvas.getContext('2d')!
    const pointer = styled(doc.createElement('div'), {
        position: 'fixed',
        left: '0',
        top: '0',
        display: 'none',
        'will-change': 'transform',
    })
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = doc.createElementNS(svgNS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    styled(svg, {
        display: 'block',
        overflow: 'visible',
        filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,.4))',
        'transform-origin': '5px 2.5px',
        transition: 'transform 80ms ease-out',
    })
    const arrow = doc.createElementNS(svgNS, 'path')
    arrow.setAttribute('d', 'M5 2.5v17.2l4.3-4.1 2.9 6.6 2.9-1.3-2.9-6.5h6.1z')
    arrow.setAttribute('stroke', '#fff')
    arrow.setAttribute('stroke-width', '1.5')
    arrow.setAttribute('stroke-linejoin', 'round')
    svg.append(arrow)
    pointer.append(svg)
    root.append(canvas, pointer)

    // ---- drawing ----

    const scale = () => (opts.cursor?.size ?? 24) / 24

    const place = () => {
        if (x === null || y === null || !opts.cursor) return
        const s = scale()
        styled(pointer, {
            display: 'block',
            transform: `translate3d(${x - 5 * s}px, ${y - 2.5 * s}px, 0)`,
        })
    }

    const ripple = () => {
        const color = opts.cursor?.ripple
        if (!color || x === null || y === null || !host.isConnected) return
        const r = 22 * scale()
        const ring = styled(doc.createElement('div'), {
            position: 'fixed',
            left: `${x - r}px`,
            top: `${y - r}px`,
            width: `${2 * r}px`,
            height: `${2 * r}px`,
            'box-sizing': 'border-box',
            'border-radius': '50%',
            border: `${Math.max(2, 2.5 * scale())}px solid ${color}`,
            // A white edge and a light fill keep the ring visible on a button of the same colour.
            background: `color-mix(in srgb, ${color} 22%, transparent)`,
            'box-shadow': '0 0 0 1px rgba(255,255,255,.9), inset 0 0 0 1px rgba(255,255,255,.9)',
        })
        root.insertBefore(ring, pointer)
        ripples++
        ring.animate(
            [
                { transform: 'scale(.2)', opacity: 0.95 },
                { transform: 'scale(1)', opacity: 0 },
            ],
            { duration: 550, easing: 'cubic-bezier(.2,.7,.3,1)' }
        ).onfinish = () => ring.remove()
    }

    /** Shades of fade the trail is drawn in: one stroke each, however long the trail is. */
    const SHADES = 16

    const draw = () => {
        drawing = 0
        const trail = opts.trail
        if (!trail) return
        const now = performance.now()
        // Points arrive in time order, so the faded ones are all at the front.
        let faded = 0
        while (faded < points.length && now - points[faded]!.t >= trail.fade) faded++
        points.splice(0, faded)
        const dpr = w.devicePixelRatio || 1
        const width = Math.round(w.innerWidth * dpr)
        const height = Math.round(w.innerHeight * dpr)
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w.innerWidth, w.innerHeight)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = trail.color
        ctx.lineWidth = trail.width
        const shades = Array.from({ length: SHADES }, () => new Path2D())
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1]!
            const b = points[i]!
            const left = 1 - (now - b.t) / trail.fade
            const shade = shades[Math.min(SHADES - 1, Math.floor(left * SHADES))]!
            shade.moveTo(a.x, a.y)
            shade.lineTo(b.x, b.y)
        }
        shades.forEach((shade, i) => {
            ctx.globalAlpha = (i + 1) / SHADES
            ctx.stroke(shade)
        })
        if (points.length) drawing = requestAnimationFrame(draw)
    }

    const enable = (next: OverlayParts) => {
        Object.assign(opts, next)
        if (opts.cursor) {
            arrow.setAttribute('fill', opts.cursor.color)
            svg.setAttribute('width', String(opts.cursor.size))
            svg.setAttribute('height', String(opts.cursor.size))
            place()
        }
        styled(canvas, { display: opts.trail ? 'block' : 'none' })
    }

    // ---- input ----

    const show = (type: string, px: number, py: number) => {
        x = px
        y = py
        if (type === 'pointerdown') {
            pressed = true
            styled(svg, { transform: 'scale(.85)' })
            ripple()
        } else if (type === 'pointerup') {
            pressed = false
            styled(svg, { transform: 'none' })
        }
        place()
        if (opts.trail) {
            // Capped, so a long fade can't grow it (and each frame's redraw) without limit.
            if (points.push({ x: px, y: py, t: performance.now() }) > 5000) points.shift()
            if (!drawing) drawing = requestAnimationFrame(draw)
        }
    }

    const onPointer = (e: PointerEvent) => show(e.type, e.clientX, e.clientY)

    /** Move to the top of the top layer, above any dialog or popover opened since. */
    const raise = () => {
        try {
            if (host.matches(':popover-open')) host.hidePopover()
            host.showPopover()
        } catch {
            // No popover support: the z-index above still puts it over almost everything.
        }
    }
    const onToggle = (e: Event) => {
        if (e.target !== host && (e as ToggleEvent).newState === 'open') raise()
    }

    const save = () => {
        try {
            if (x !== null) sessionStorage.setItem(STORE, JSON.stringify([x, y]))
        } catch {
            // Storage is off or the page is sandboxed: the cursor shows on the next move.
        }
    }

    const mount = () => {
        if (doc.readyState === 'loading') {
            doc.addEventListener('DOMContentLoaded', mount, { once: true })
        } else if (doc.documentElement && !host.isConnected) {
            doc.documentElement.append(host)
            raise()
        }
    }

    try {
        const saved = JSON.parse(sessionStorage.getItem(STORE) ?? 'null')
        if (Array.isArray(saved)) [x, y] = saved
    } catch {
        // Nothing saved, or no storage.
    }

    Object.defineProperty(w, KEY, {
        value: {
            enable,
            state: (): OverlayState => ({
                x,
                y,
                visible: host.isConnected && pointer.style.display === 'block',
                pressed,
                ripples,
                trail: points.length,
            }),
        },
    })
    enable(parts)
    listen(
        [
            ['pointermove', onPointer],
            ['pointerdown', onPointer],
            ['pointerup', onPointer],
            ['message', fromFrames(show)],
            ['toggle', onToggle],
            ['pagehide', save],
        ],
        mount
    )
}
