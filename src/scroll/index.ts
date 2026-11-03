import { requireOption } from '../errors'
import type { Random } from '../random'

/** One wheel event: wait `delay` ms, then scroll by `dx`, `dy` pixels. */
export interface WheelStep {
    dx: number
    dy: number
    delay: number
}

export interface ScrollRequest {
    /** Pixels to scroll down (negative scrolls up). */
    dy: number
    /** Pixels to scroll right (negative scrolls left). */
    dx?: number
    random: Random
}

/** A scroll strategy turns a distance into timed wheel events. */
export interface ScrollStrategy {
    readonly name: string
    plan(request: ScrollRequest): WheelStep[]
}

export interface WheelScrollOptions {
    /** Pixels per wheel notch. Default 100, what Chrome uses for one click of a mouse wheel. */
    notch?: number
    /** Notches per flick of the finger before a short pause. Default 3 to 7. */
    burst?: [min: number, max: number]
}

/**
 * The default scroll: a mouse wheel turned in bursts of notches, with short gaps inside a burst
 * and longer pauses between bursts while the finger resets.
 */
export function wheelScroll(options: WheelScrollOptions = {}): ScrollStrategy {
    requireOption(
        !('flick' in options),
        'scroll.flick is a trackpadScroll() option, but scroll was given as wheel options.',
        'Pass scroll: trackpadScroll({ flick: [min, max] }).'
    )
    const notch = options.notch ?? 100
    const [burstMin, burstMax] = options.burst ?? [3, 7]
    requireOption(
        notch > 0,
        `scroll.notch must be above 0, got ${notch}.`,
        'Default 100 (px), one click of a Chrome mouse wheel.'
    )
    requireOption(
        burstMin >= 1 && burstMax >= burstMin,
        `scroll.burst must be [min, max] with 1 ≤ min ≤ max, got [${burstMin}, ${burstMax}].`,
        'Default [3, 7] notches per flick.'
    )

    const axis = (pixels: number): number[] => {
        const steps: number[] = []
        const sign = Math.sign(pixels)
        let left = Math.abs(pixels)
        while (left > 0) {
            // Real wheels move whole notches; only the final step is trimmed to land on target.
            const step = Math.min(notch, left)
            steps.push(sign * step)
            left -= step
        }
        return steps
    }

    return {
        name: 'wheel',
        plan({ dy, dx = 0, random }) {
            const vertical = axis(Math.round(dy))
            const horizontal = axis(Math.round(dx))
            const count = Math.max(vertical.length, horizontal.length)
            const steps: WheelStep[] = []
            let inBurst = 0
            let burstSize = random.int(burstMin, burstMax)
            for (let i = 0; i < count; i++) {
                let delay = i === 0 ? random.range(20, 60) : random.range(25, 70)
                if (inBurst >= burstSize) {
                    delay = random.range(160, 420)
                    inBurst = 0
                    burstSize = random.int(burstMin, burstMax)
                }
                inBurst++
                steps.push({
                    dx: horizontal[i] ?? 0,
                    dy: vertical[i] ?? 0,
                    delay: Math.round(delay),
                })
            }
            return steps
        },
    }
}

export interface TrackpadScrollOptions {
    /** Pixels per flick of two fingers, before they lift and flick again. Default 300 to 700. */
    flick?: [min: number, max: number]
}

/**
 * Scrolling on a laptop trackpad: each flick sends a stream of small wheel events, about one a
 * frame, that speed up while the fingers move and then glide to a stop.
 */
export function trackpadScroll(options: TrackpadScrollOptions = {}): ScrollStrategy {
    const [flickMin, flickMax] = options.flick ?? [300, 700]
    requireOption(
        flickMin > 0 && flickMax >= flickMin && Number.isFinite(flickMax),
        `scroll.flick must be [min, max] with 0 < min ≤ max, got [${flickMin}, ${flickMax}].`,
        'Default [300, 700] px per flick.'
    )

    /** How far each frame of one flick goes, as shares of the flick that add up to 1. */
    const flickShape = (random: Random): number[] => {
        const speeds: number[] = []
        // The fingers speed up over a few frames...
        const rise = random.int(3, 6)
        for (let i = 1; i <= rise; i++) speeds.push(Math.sin(((i / rise) * Math.PI) / 2))
        // ...then lift, and the page glides on, slowing by the same fraction every frame.
        const friction = Math.exp(-random.range(0.08, 0.12))
        for (let speed = friction; speed > 0.05; speed *= friction) speeds.push(speed)
        const total = speeds.reduce((sum, speed) => sum + speed, 0)
        return speeds.map((speed) => speed / total)
    }

    return {
        name: 'trackpad',
        plan({ dy, dx = 0, random }) {
            const x = Math.round(dx)
            const y = Math.round(dy)
            if (!x && !y) return []
            // Frames as shares of the whole distance, with how long to wait before each.
            const frames: { share: number; delay: number }[] = []
            const count = Math.ceil(Math.hypot(x, y) / random.range(flickMin, flickMax))
            const sizes = Array.from({ length: count }, () => random.range(0.9, 1.1))
            const total = sizes.reduce((sum, size) => sum + size, 0)
            sizes.forEach((size, flick) => {
                flickShape(random).forEach((share, i) => {
                    const delay =
                        i > 0
                            ? random.range(14, 19) // about one event a frame
                            : flick > 0
                              ? random.range(100, 250) // the fingers come back for another flick
                              : random.range(20, 60)
                    frames.push({ share: (share * size) / total, delay })
                })
            })

            // Round the running total, not each frame, so the steps land exactly on the distance.
            // Frames that round to nothing send no event; their time passes before the next one.
            const steps: WheelStep[] = []
            let done = 0
            let sent = { dx: 0, dy: 0 }
            let waited = 0
            frames.forEach((frame, i) => {
                done = i === frames.length - 1 ? 1 : done + frame.share
                const at = { dx: Math.round(x * done), dy: Math.round(y * done) }
                waited += frame.delay
                if (at.dx === sent.dx && at.dy === sent.dy) return
                // `|| 0` keeps an axis that hasn't moved at 0, not -0.
                steps.push({
                    dx: at.dx - sent.dx || 0,
                    dy: at.dy - sent.dy || 0,
                    delay: Math.round(waited),
                })
                sent = at
                waited = 0
            })
            return steps
        },
    }
}

/** Identity helper so TypeScript checks and autocompletes a custom scroll strategy. */
export const defineScroll = <T extends ScrollStrategy>(strategy: T): T => strategy
