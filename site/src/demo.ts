/**
 * "Spot the robot": Playwright's click next to ours, on one stage. The robot cursor teleports to
 * the dead centre, as `page.click()` does. The human one is the library itself: `createHuman` with
 * the `demo` preset, driving the stage through a small driver instead of a browser tab, so every
 * move, pause and press is the one a script would make. Replay runs the same seed from the same
 * spot and draws the same path.
 */
import { type Box, createHuman, defineDriver, type ElementRef, type Point } from '../../src'

/** How long a trail point stays visible, in ms. */
const FADE = 1000
/** Where the arrow's tip sits inside the 22 px cursor. */
const TIP = { x: 4.6, y: 2.3 }

interface Move {
    /** Where each cursor starts. */
    from: { robot: Point; human: Point }
    seed: number
    /** A selector such as `#signup`, when the click was on one of the stage's targets. */
    target?: string
    /** The click point, when it wasn't. */
    point?: Point
}

export function startDemo(root: HTMLElement): void {
    const stage = root.querySelector<HTMLElement>('[data-stage]')!
    const canvas = stage.querySelector('canvas')!
    const ctx = canvas.getContext('2d')!
    const robot = stage.querySelector<HTMLElement>('[data-cursor="robot"]')!
    const human = stage.querySelector<HTMLElement>('[data-cursor="human"]')!
    const out = (name: string) => root.querySelector<HTMLElement>(`[data-out="${name}"]`)!
    const replay = root.querySelector<HTMLButtonElement>('[data-replay]')!
    const live = root.querySelector<HTMLElement>('[aria-live]')!
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

    let size = { width: stage.clientWidth, height: stage.clientHeight }
    let humanAt: Point = { x: 40, y: size.height - 40 }
    let robotAt: Point = { ...humanAt }
    let trail: { x: number; y: number; at: number }[] = []
    let jump: { from: Point; to: Point; at: number } | null = null
    /** The move in progress (a counter), or 0. */
    let playing = 0
    let last: Move | null = null
    let nextSeed = Math.floor(Math.random() * 100_000)

    const place = (el: HTMLElement, p: Point) => {
        el.style.transform = `translate(${p.x - TIP.x}px, ${p.y - TIP.y}px)`
    }
    place(robot, robotAt)
    place(human, humanAt)

    const ripple = (p: Point, kind: 'robot' | 'human') => {
        const ring = document.createElement('span')
        ring.className = `ripple ripple-${kind}`
        ring.style.left = `${p.x}px`
        ring.style.top = `${p.y}px`
        ring.addEventListener('animationend', () => ring.remove())
        stage.append(ring)
    }

    const boxOf = (el: Element): Box => {
        const s = stage.getBoundingClientRect()
        const r = el.getBoundingClientRect()
        return { x: r.left - s.left, y: r.top - s.top, width: r.width, height: r.height }
    }

    function resize() {
        size = { width: stage.clientWidth, height: stage.clientHeight }
        const ratio = devicePixelRatio || 1
        canvas.width = size.width * ratio
        canvas.height = size.height * ratio
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    new ResizeObserver(resize).observe(stage)
    resize()

    /** Draws the fading trail and Playwright's jump, until both have faded. */
    let drawing = false
    function draw() {
        const now = performance.now()
        ctx.clearRect(0, 0, size.width, size.height)
        while (trail.length && now - trail[0]!.at >= FADE) trail.shift()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 3
        for (let i = 1; i < trail.length; i++) {
            const a = trail[i - 1]!
            const b = trail[i]!
            ctx.strokeStyle = `rgba(79, 70, 229, ${(1 - (now - b.at) / FADE) * 0.55})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
        }
        if (jump && now - jump.at < 700) {
            ctx.setLineDash([2, 7])
            ctx.lineWidth = 2
            ctx.strokeStyle = `rgba(100, 116, 139, ${1 - (now - jump.at) / 700})`
            ctx.beginPath()
            ctx.moveTo(jump.from.x, jump.from.y)
            ctx.lineTo(jump.to.x, jump.to.y)
            ctx.stroke()
            ctx.setLineDash([])
        } else {
            jump = null
        }
        if (trail.length || jump || playing) requestAnimationFrame(draw)
        else drawing = false
    }
    const redraw = () => {
        if (drawing) return
        drawing = true
        requestAnimationFrame(draw)
    }

    /**
     * The library's view of the stage: its mouse events move the indigo cursor, and its targets
     * are the stage's buttons. A move that a newer one replaced fails at its next event.
     */
    function stageDriver(id: number, stats: { moves: number }, button: Element | null) {
        const current = () => {
            if (id !== playing) throw new Error('A newer move took over')
        }
        const elementRef = (el: Element, selector: string): ElementRef => ({
            description: selector,
            waitForVisible: async () => true,
            exists: async () => true,
            box: async () => boxOf(el),
            scrollIntoView: async () => {},
            hitTest: async () => ({ ok: true }),
            caretToEnd: async () => {},
        })
        return defineDriver({
            name: 'stage',
            async moveMouse(x, y) {
                current()
                stats.moves++
                humanAt = { x, y }
                place(human, humanAt)
                trail.push({ x, y, at: performance.now() })
            },
            async mouseDown() {
                current()
                ripple(humanAt, 'human')
                button?.classList.add('pressed')
            },
            async mouseUp() {
                button?.classList.remove('pressed')
                current()
            },
            async wheel() {},
            async keyDown() {},
            async keyUp() {},
            async insertText() {},
            viewport: async () => size,
            scrollOffset: async () => ({ x: 0, y: 0, maxX: 0, maxY: 0 }),
            locate(target) {
                const el = typeof target === 'string' ? stage.querySelector(target) : null
                return el && elementRef(el, target as string)
            },
            // The demo preset's cursor overlay: the stage draws its own.
            async addScript() {},
        })
    }

    /** Both cursors make the same click: Playwright's at once, ours through the library. */
    async function run(move: Move) {
        last = move
        const id = ++playing
        const el = move.target ? stage.querySelector(move.target) : null
        const box = el && boxOf(el)
        const robotTo = box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : move.point!
        const what = move.target
            ? `'${move.target}'`
            : `{ x: ${move.point!.x}, y: ${move.point!.y} }`
        out('robot-code').textContent = move.target
            ? `await page.click(${what})`
            : `await page.mouse.click(${move.point!.x}, ${move.point!.y})`
        out('human-code').textContent = `await human.click(${what})`
        out('human-stats').textContent = 'moving…'
        out('seed').textContent = `seed ${move.seed}`
        replay.disabled = false

        // Playwright: one move event, straight to the centre.
        jump = { from: move.from.robot, to: robotTo, at: performance.now() }
        robotAt = robotTo
        place(robot, robotAt)
        ripple(robotAt, 'robot')

        // Ours: the real thing, on the real clock.
        const stats = { moves: 0 }
        humanAt = move.from.human
        trail = []
        redraw()
        const start = performance.now()
        try {
            await createHuman(stage, {
                driver: stageDriver(id, stats, el),
                preset: 'demo',
                seed: move.seed,
                startPosition: move.from.human,
            }).click(move.target ?? move.point!)
        } catch (error) {
            if (id !== playing) return
            throw error
        }
        out('human-stats').textContent =
            `${stats.moves} mouse moves · ${Math.round(performance.now() - start)} ms`
        playing = 0
    }

    const moveTo = (target: string | null, point?: Point) =>
        run({
            from: { robot: robotAt, human: humanAt },
            seed: nextSeed++,
            ...(target ? { target } : { point }),
        })

    // Autoplay through the form until someone clicks, while the demo is on screen. The code bar is
    // only announced to screen readers once they're the ones making the moves.
    const stops = [...stage.querySelectorAll('[data-target]')].map((el) => `#${el.id}`)
    let touring = !reducedMotion
    let visible = false
    let stop = 0
    let timer = 0
    function tour() {
        clearTimeout(timer)
        if (!touring || !visible) return
        timer = window.setTimeout(async () => {
            if (!playing) await moveTo(stops[stop++ % stops.length]!)
            tour()
        }, 900)
    }
    new IntersectionObserver(([entry]) => {
        visible = !!entry?.isIntersecting
        tour()
    }).observe(stage)
    const takeOver = () => {
        touring = false
        clearTimeout(timer)
        live.setAttribute('aria-live', 'polite')
    }

    stage.addEventListener('click', (e) => {
        takeOver()
        const target = (e.target as Element).closest('[data-target]')
        // Keyboard "clicks" on a target report 0, 0: aim at the target itself.
        if (target) {
            moveTo(`#${target.id}`)
            return
        }
        const s = stage.getBoundingClientRect()
        moveTo(null, { x: Math.round(e.clientX - s.left), y: Math.round(e.clientY - s.top) })
    })
    replay.addEventListener('click', () => {
        if (!last) return
        takeOver()
        run(last)
    })
}
