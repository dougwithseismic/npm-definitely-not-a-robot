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

/** Identity helper so TypeScript checks and autocompletes a custom scroll strategy. */
export const defineScroll = <T extends ScrollStrategy>(strategy: T): T => strategy
