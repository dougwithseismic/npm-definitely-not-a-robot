import type { Random } from './random'

export interface Point {
    x: number
    y: number
}

/** A point the cursor should reach `t` milliseconds after the movement starts. */
export interface TimedPoint extends Point {
    t: number
}

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export interface Size {
    width: number
    height: number
}

export const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)

export const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value))

/** A point on a cubic Bezier curve at `t` in [0, 1]. */
export function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const d = t * t * t
    return {
        x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
        y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    }
}

/**
 * Minimum-jerk position profile: how far along a movement a hand is at time fraction `t`.
 * Slow start, fastest in the middle, slow finish.
 */
export const minimumJerk = (t: number): number => t * t * t * (10 - 15 * t + 6 * t * t)

export const boxCenter = (box: Box): Point => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
})

export const isInside = (point: Point, box: Box): boolean =>
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height

/**
 * Where to aim inside a box, as offsets from its centre in units of its size. Drawn once per aim,
 * so retrying against a box that moved doesn't use up extra random numbers.
 */
export interface Spot {
    u: number
    v: number
}

/** A spot near the centre: gaussian with a spread of a seventh of the box. */
export const pickSpot = (random: Random): Spot => ({
    u: random.gaussian(0, 1 / 7),
    v: random.gaussian(0, 1 / 7),
})

/** The pixel for a spot in a box, kept off the outer 15% (at least 2 px) of each side. */
export function placeInBox(box: Box, spot: Spot): Point {
    const center = boxCenter(box)
    const padX = Math.min(box.width / 2, Math.max(2, box.width * 0.15))
    const padY = Math.min(box.height / 2, Math.max(2, box.height * 0.15))
    return {
        x: Math.round(clamp(center.x + spot.u * box.width, box.x + padX, box.x + box.width - padX)),
        y: Math.round(
            clamp(center.y + spot.v * box.height, box.y + padY, box.y + box.height - padY)
        ),
    }
}
