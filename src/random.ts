/**
 * A seedable pseudo-random number generator. Every random choice the library makes goes through
 * one of these, so the same seed replays the same paths and timings.
 */
export interface Random {
    /** The seed this generator started from. Pass it back as `seed` to replay a run. */
    readonly seed: number
    /** A float in [0, 1). */
    next(): number
    /** A float in [min, max). */
    range(min: number, max: number): number
    /** An integer in [min, max], both ends included. */
    int(min: number, max: number): number
    /** True with probability `p`. */
    chance(p: number): boolean
    /** A sample from a normal (bell-curve) distribution. */
    gaussian(mean?: number, sd?: number): number
    /** A sample from a log-normal distribution: positive, skewed towards slow. */
    logNormal(median: number, sigma: number): number
    /** One item from a non-empty list. */
    pick<T>(items: readonly T[]): T
}

/** Mulberry32: a tiny, fast 32-bit generator with good statistical quality for this job. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export function randomSeed(): number {
    return Math.floor(Math.random() * 2 ** 31)
}

/**
 * A seed for one of several independent streams drawn from one seed, so how many numbers one
 * stream uses can't shift what another draws.
 */
export function streamSeed(seed: number, stream: number): number {
    let h = (seed ^ Math.imul(stream + 1, 0x9e3779b9)) >>> 0
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
    return (h ^ (h >>> 16)) >>> 0
}

export function createRandom(seed: number = randomSeed()): Random {
    const next = mulberry32(seed)
    let spare: number | undefined

    const gaussian = (mean = 0, sd = 1): number => {
        if (spare !== undefined) {
            const value = spare
            spare = undefined
            return mean + sd * value
        }
        // Box–Muller: two uniform samples become two independent normal samples.
        let u = 0
        while (u === 0) u = next()
        const v = next()
        const radius = Math.sqrt(-2 * Math.log(u))
        spare = radius * Math.sin(2 * Math.PI * v)
        return mean + sd * radius * Math.cos(2 * Math.PI * v)
    }

    return {
        seed,
        next,
        range: (min, max) => min + (max - min) * next(),
        int: (min, max) => Math.floor(min + (max - min + 1) * next()),
        chance: (p) => next() < p,
        gaussian,
        logNormal: (median, sigma) => median * Math.exp(gaussian(0, sigma)),
        pick: (items) => {
            if (items.length === 0) throw new RangeError('pick() needs at least one item')
            return items[Math.floor(next() * items.length)] as (typeof items)[number]
        },
    }
}
