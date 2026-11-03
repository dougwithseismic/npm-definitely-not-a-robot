import { describe, expect, it } from 'vitest'
import { bezierMotion, createRandom, naturalTyping, wheelScroll } from '../../src'
import { distance, pickSpot, placeInBox } from '../../src/geometry'

describe('createRandom', () => {
    it('replays the same sequence for the same seed', () => {
        const a = createRandom(42)
        const b = createRandom(42)
        const seqA = Array.from({ length: 50 }, () => a.next())
        const seqB = Array.from({ length: 50 }, () => b.next())
        expect(seqA).toEqual(seqB)
        expect(createRandom(43).next()).not.toEqual(seqA[0])
    })

    it('keeps values in range', () => {
        const r = createRandom(1)
        for (let i = 0; i < 1000; i++) {
            const n = r.next()
            expect(n).toBeGreaterThanOrEqual(0)
            expect(n).toBeLessThan(1)
            const k = r.int(3, 5)
            expect([3, 4, 5]).toContain(k)
            expect(r.logNormal(100, 0.5)).toBeGreaterThan(0)
        }
    })

    it('produces a bell curve from gaussian()', () => {
        const r = createRandom(7)
        const samples = Array.from({ length: 5000 }, () => r.gaussian(10, 2))
        const mean = samples.reduce((s, v) => s + v, 0) / samples.length
        const sd = Math.sqrt(samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length)
        expect(mean).toBeCloseTo(10, 0)
        expect(sd).toBeCloseTo(2, 0)
    })
})

describe('placeInBox', () => {
    it('stays inside the box, away from the edges', () => {
        const r = createRandom(3)
        const box = { x: 100, y: 200, width: 120, height: 40 }
        for (let i = 0; i < 500; i++) {
            const p = placeInBox(box, pickSpot(r))
            expect(p.x).toBeGreaterThanOrEqual(box.x + 0.15 * box.width - 1)
            expect(p.x).toBeLessThanOrEqual(box.x + box.width * 0.85 + 1)
            expect(p.y).toBeGreaterThanOrEqual(box.y + 0.15 * box.height - 1)
            expect(p.y).toBeLessThanOrEqual(box.y + box.height * 0.85 + 1)
        }
    })

    it('handles tiny targets', () => {
        const p = placeInBox({ x: 10, y: 10, width: 3, height: 3 }, pickSpot(createRandom(1)))
        expect(p.x).toBeGreaterThanOrEqual(10)
        expect(p.x).toBeLessThanOrEqual(13)
    })
})

describe('bezierMotion', () => {
    const motion = bezierMotion()
    const from = { x: 50, y: 500 }
    const to = { x: 900, y: 120 }

    it('ends exactly on the target with increasing timestamps', () => {
        for (let seed = 0; seed < 50; seed++) {
            const path = motion.plan({ from, to, random: createRandom(seed) })
            expect(path.at(-1)).toMatchObject(to)
            for (let i = 1; i < path.length; i++) {
                expect(path[i]!.t).toBeGreaterThanOrEqual(path[i - 1]!.t)
            }
        }
    })

    it('curves away from the straight line', () => {
        let maxDeviation = 0
        const path = motion.plan({ from, to, random: createRandom(11) })
        const len = distance(from, to)
        for (const p of path) {
            // Distance from point to the line through from→to.
            const dev =
                Math.abs(
                    (to.y - from.y) * p.x - (to.x - from.x) * p.y + to.x * from.y - to.y * from.x
                ) / len
            maxDeviation = Math.max(maxDeviation, dev)
        }
        expect(maxDeviation).toBeGreaterThan(10)
    })

    it('takes longer for far, small targets than near, big ones (Fitts)', () => {
        const avg = (fn: (seed: number) => number) =>
            Array.from({ length: 30 }, (_, s) => fn(s)).reduce((a, b) => a + b, 0) / 30
        const far = avg(
            (s) => motion.plan({ from, to, targetSize: 10, random: createRandom(s) }).at(-1)!.t
        )
        const near = avg(
            (s) =>
                motion
                    .plan({ from, to: { x: 120, y: 480 }, targetSize: 80, random: createRandom(s) })
                    .at(-1)!.t
        )
        expect(far).toBeGreaterThan(near * 2)
    })

    it('sometimes overshoots on long moves', () => {
        let overshoots = 0
        for (let seed = 0; seed < 60; seed++) {
            const path = motion.plan({ from, to, random: createRandom(seed) })
            // An overshoot passes the target along the direction of travel.
            if (path.some((p) => p.x > to.x + 3)) overshoots++
        }
        expect(overshoots).toBeGreaterThan(5)
        expect(overshoots).toBeLessThan(45)
    })

    it('can be perfectly smooth', () => {
        const smooth = bezierMotion({ tremor: 0, overshoot: 0 })
        const a = smooth.plan({ from, to, random: createRandom(5) })
        expect(a.every((p) => p.x <= to.x)).toBe(true)
    })

    it('is identical for the same seed', () => {
        const a = motion.plan({ from, to, random: createRandom(99) })
        const b = motion.plan({ from, to, random: createRandom(99) })
        expect(a).toEqual(b)
    })

    it('handles a zero-length move', () => {
        expect(motion.plan({ from, to: from, random: createRandom(1) })).toHaveLength(1)
    })
})

describe('naturalTyping', () => {
    /** Replays keystrokes into a string the way a text field would. */
    const replay = (keys: string[]) =>
        keys.reduce((text, key) => {
            if (key === 'Backspace') return text.slice(0, -1)
            return text + key
        }, '')

    it('types the text exactly, typos included', () => {
        const text = 'Hello there, Ada Lovelace! The quick brown fox (1815).\nSecond line'
        for (let seed = 0; seed < 40; seed++) {
            const strokes = naturalTyping({ typos: 0.15 }).plan({
                text,
                random: createRandom(seed),
            })
            expect(replay(strokes.map((s) => s.key))).toBe(text)
        }
    })

    it('actually makes typos when asked', () => {
        const strokes = naturalTyping({ typos: 0.2 }).plan({
            text: 'the quick brown fox jumps over the lazy dog',
            random: createRandom(1),
        })
        expect(strokes.some((s) => s.key === 'Backspace')).toBe(true)
    })

    it('makes no typos by default', () => {
        const strokes = naturalTyping().plan({ text: 'hello world', random: createRandom(1) })
        expect(strokes.map((s) => s.key).join('')).toBe('hello world')
    })

    it('averages roughly the requested speed', () => {
        const text = 'the quick brown fox jumps over the lazy dog '.repeat(10)
        const strokes = naturalTyping({ wpm: 60 }).plan({ text, random: createRandom(2) })
        const totalMs = strokes.reduce((sum, s) => sum + s.delay + s.hold, 0)
        const wpm = text.length / 5 / (totalMs / 60_000)
        expect(wpm).toBeGreaterThan(40)
        expect(wpm).toBeLessThan(80)
    })

    it('varies the gaps between keys', () => {
        const strokes = naturalTyping().plan({
            text: 'consistent rhythm test',
            random: createRandom(4),
        })
        const delays = new Set(strokes.map((s) => s.delay))
        expect(delays.size).toBeGreaterThan(10)
    })

    it('rejects a nonsense speed', () => {
        expect(() => naturalTyping({ wpm: 0 })).toThrow(/wpm/)
    })
})

describe('wheelScroll', () => {
    it('adds up to the requested distance in notch-sized steps', () => {
        const steps = wheelScroll().plan({ dy: 1250, random: createRandom(1) })
        expect(steps.reduce((s, x) => s + x.dy, 0)).toBe(1250)
        expect(steps.length).toBeGreaterThan(10)
        expect(steps.every((s) => Math.abs(s.dy) <= 100)).toBe(true)
    })

    it('scrolls up with negative distances', () => {
        const steps = wheelScroll().plan({ dy: -300, random: createRandom(1) })
        expect(steps.reduce((s, x) => s + x.dy, 0)).toBe(-300)
    })

    it('pauses between bursts', () => {
        const steps = wheelScroll().plan({ dy: 3000, random: createRandom(1) })
        expect(steps.some((s) => s.delay > 150)).toBe(true)
        expect(steps.some((s) => s.delay < 80)).toBe(true)
    })

    it('returns nothing for zero', () => {
        expect(wheelScroll().plan({ dy: 0, random: createRandom(1) })).toEqual([])
    })
})
