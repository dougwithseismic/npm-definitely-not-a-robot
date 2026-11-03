import { requireOption } from '../errors'
import { cubicBezier, distance, minimumJerk, type Point, type TimedPoint } from '../geometry'
import type { Random } from '../random'

export interface MotionRequest {
    from: Point
    to: Point
    /** The smaller side of the target, in px. Small targets take longer to hit (Fitts's law). */
    targetSize?: number
    random: Random
}

/**
 * A motion strategy turns "go from A to B" into timed points. Planning is pure: no browser, no
 * waiting, so strategies are easy to test and can run anywhere.
 */
export interface MotionStrategy {
    readonly name: string
    /** Points after `from`, ending exactly at `to`, with `t` in ms since the movement started. */
    plan(request: MotionRequest): TimedPoint[]
}

export interface BezierMotionOptions {
    /**
     * Fitts's law constants in ms: movement time = a + b × log2(distance / size + 1).
     * Raise `b` for a slower, more careful hand.
     */
    fitts?: { a?: number; b?: number }
    /** How far paths bow away from a straight line, as a share of the distance. Default 0.22. */
    curvature?: number
    /** Chance of overshooting and correcting on moves longer than 300 px. Default 0.3. */
    overshoot?: number
    /** Hand wobble in px. Default 0.7. Use 0 for perfectly smooth demo paths. */
    tremor?: number
    /** Time between mouse events in ms. Default 16 (about 60 per second, like a real browser). */
    interval?: number
}

const DEFAULT_TARGET_SIZE = 40

/**
 * The default motion: a cubic Bezier arc timed by Fitts's law, eased with a minimum-jerk profile,
 * with optional overshoot-and-correct on long moves and a little tremor.
 */
export function bezierMotion(options: BezierMotionOptions = {}): MotionStrategy {
    const a = options.fitts?.a ?? 90
    const b = options.fitts?.b ?? 140
    const curvature = options.curvature ?? 0.22
    const overshoot = options.overshoot ?? 0.3
    const tremor = options.tremor ?? 0.7
    const interval = options.interval ?? 16
    requireOption(
        a >= 0 && b >= 0,
        `motion.fitts must be 0 or more, got a: ${a}, b: ${b}.`,
        'Defaults are a: 90 and b: 140 (ms).'
    )
    requireOption(
        curvature >= 0,
        `motion.curvature must be 0 or more, got ${curvature}.`,
        'Default 0.22; 0 gives straight lines.'
    )
    requireOption(
        overshoot >= 0 && overshoot <= 1,
        `motion.overshoot must be between 0 and 1, got ${overshoot}.`,
        'It is a chance: 0.3 overshoots about one long move in three.'
    )
    requireOption(
        tremor >= 0,
        `motion.tremor must be 0 or more, got ${tremor}.`,
        'Default 0.7 (px); 0 gives perfectly smooth paths.'
    )
    requireOption(
        interval > 0,
        `motion.interval must be above 0, got ${interval}.`,
        'Default 16 (ms), about 60 mouse events a second.'
    )

    const movementTime = (from: Point, to: Point, size: number, random: Random): number => {
        const fitts = a + b * Math.log2(distance(from, to) / Math.max(size, 1) + 1)
        return Math.max(60, fitts * random.range(0.85, 1.2))
    }

    const segment = (
        from: Point,
        to: Point,
        duration: number,
        bow: number,
        startAt: number,
        random: Random
    ): TimedPoint[] => {
        const d = distance(from, to)
        const dx = (to.x - from.x) / (d || 1)
        const dy = (to.y - from.y) / (d || 1)
        // Perpendicular unit vector: control points are pushed sideways along it to make the arc.
        const px = -dy
        const py = dx
        const side = random.chance(0.5) ? 1 : -1
        const offset1 = side * d * bow * random.range(0.4, 1)
        // Mostly a simple arc (both controls on one side); sometimes a gentle S-curve.
        const offset2 = random.chance(0.8)
            ? offset1 * random.range(0.3, 0.9)
            : -offset1 * random.range(0.2, 0.5)
        const c1 = {
            x: from.x + dx * d * random.range(0.2, 0.4) + px * offset1,
            y: from.y + dy * d * random.range(0.2, 0.4) + py * offset1,
        }
        const c2 = {
            x: from.x + dx * d * random.range(0.6, 0.8) + px * offset2,
            y: from.y + dy * d * random.range(0.6, 0.8) + py * offset2,
        }

        const points: TimedPoint[] = []
        let elapsed = 0
        while (elapsed < duration) {
            elapsed = Math.min(duration, elapsed + interval * random.range(0.8, 1.25))
            const progress = minimumJerk(elapsed / duration)
            const point = cubicBezier(from, c1, c2, to, progress)
            // Tremor fades out near both ends so the path still starts and lands cleanly.
            const wobble = tremor * Math.sin(Math.PI * progress)
            points.push({
                x: point.x + random.gaussian(0, wobble),
                y: point.y + random.gaussian(0, wobble),
                t: startAt + elapsed,
            })
        }
        const last = points[points.length - 1]
        if (last) {
            last.x = to.x
            last.y = to.y
        }
        return points
    }

    return {
        name: 'bezier',
        plan({ from, to, targetSize = DEFAULT_TARGET_SIZE, random }) {
            const d = distance(from, to)
            if (d < 1) return [{ x: to.x, y: to.y, t: interval }]

            let points: TimedPoint[]
            if (d > 300 && random.chance(overshoot)) {
                // Fly a little past the target, then make a short, slower correction back.
                const past = Math.min(40, d * random.range(0.03, 0.08))
                const dx = (to.x - from.x) / d
                const dy = (to.y - from.y) / d
                const miss = {
                    x: to.x + dx * past + random.gaussian(0, past / 3),
                    y: to.y + dy * past + random.gaussian(0, past / 3),
                }
                const first = segment(
                    from,
                    miss,
                    movementTime(from, miss, targetSize * 2, random),
                    curvature,
                    0,
                    random
                )
                const reachedAt = first[first.length - 1]?.t ?? 0
                const settle = reachedAt + random.range(40, 110)
                const second = segment(
                    miss,
                    to,
                    movementTime(miss, to, targetSize, random) * 0.8,
                    curvature / 3,
                    settle,
                    random
                )
                points = [...first, ...second]
            } else {
                points = segment(
                    from,
                    to,
                    movementTime(from, to, targetSize, random),
                    curvature,
                    0,
                    random
                )
            }
            return dedupe(points)
        },
    }
}

/** Mice report whole pixels, and a move to the same pixel fires no event, so drop repeats. */
function dedupe(points: TimedPoint[]): TimedPoint[] {
    const result: TimedPoint[] = []
    let previous: Point | undefined
    for (const point of points) {
        const rounded = { x: Math.round(point.x), y: Math.round(point.y), t: Math.round(point.t) }
        if (previous && previous.x === rounded.x && previous.y === rounded.y) continue
        result.push(rounded)
        previous = rounded
    }
    return result
}

/** Identity helper so TypeScript checks and autocompletes a custom motion strategy. */
export const defineMotion = <T extends MotionStrategy>(strategy: T): T => strategy
