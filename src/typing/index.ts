import { requireOption } from '../errors'
import { clamp } from '../geometry'
import type { Random } from '../random'

/** One key press: wait `delay` ms after the previous key was released, then hold for `hold` ms. */
export interface Keystroke {
    /** A single character to type, or a key name such as `'Backspace'`, `'Enter'`, `'Tab'`. */
    key: string
    delay: number
    hold: number
}

export interface TypingRequest {
    text: string
    random: Random
}

/** A typing strategy turns text into timed keystrokes. Pure, like motion strategies. */
export interface TypingStrategy {
    readonly name: string
    plan(request: TypingRequest): Keystroke[]
}

export interface NaturalTypingOptions {
    /** Words per minute (a word is five characters). Default 65; most people type 40 to 80. */
    wpm?: number
    /** How uneven the rhythm is, 0 (metronome) to about 0.6 (very uneven). Default 0.35. */
    variance?: number
    /**
     * Chance per letter of hitting a neighbouring key, noticing, and fixing it with Backspace.
     * Default 0. Around 0.02 looks natural. The field always ends up with exactly your text.
     */
    typos?: number
}

// Common English letter pairs are typed faster than the average pair.
const FAST_PAIRS = new Set(
    'th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me de hi ri ro ic ne ea ra ce'.split(
        ' '
    )
)

const QWERTY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

/**
 * Keys physically next to each letter on a US QWERTY keyboard. Rows are staggered, so the row
 * above touches columns c and c+1 and the row below touches c-1 and c.
 */
const NEIGHBOURS: Record<string, string> = (() => {
    const map: Record<string, string> = {}
    const offsets: [number, number[]][] = [
        [-1, [0, 1]],
        [0, [-1, 1]],
        [1, [-1, 0]],
    ]
    QWERTY_ROWS.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
            let near = ''
            for (const [dr, cols] of offsets) {
                const other = QWERTY_ROWS[r + dr]
                for (const dc of cols) near += other?.[c + dc] ?? ''
            }
            map[row[c] as string] = near
        }
    })
    return map
})()

const SENTENCE_END = /[.!?]/
const NEEDS_SHIFT = /[A-Z~!@#$%^&*()_+{}|:"<>?]/

/** True when typing this character on a US keyboard means holding Shift. */
export const needsShift = (key: string): boolean => key.length === 1 && NEEDS_SHIFT.test(key)

export function naturalTyping(options: NaturalTypingOptions = {}): TypingStrategy {
    const wpm = options.wpm ?? 65
    const variance = options.variance ?? 0.35
    const typos = options.typos ?? 0
    requireOption(
        wpm > 0,
        `typing.wpm must be above 0, got ${wpm}.`,
        'Default 65 words a minute; most people type 40 to 80.'
    )
    requireOption(
        variance >= 0,
        `typing.variance must be 0 or more, got ${variance}.`,
        'Default 0.35; 0 types like a metronome.'
    )
    requireOption(
        typos >= 0 && typos <= 1,
        `typing.typos must be between 0 and 1, got ${typos}.`,
        'It is a chance per character: 0.02 makes about one typo in 50 letters.'
    )

    // Average time from one key press to the next.
    const interval = 60_000 / (wpm * 5)

    return {
        name: 'natural',
        plan({ text, random }) {
            const strokes: Keystroke[] = []
            const chars = [...text]
            let previousHold = 0

            const push = (key: string, gap: number) => {
                const hold = clamp(random.logNormal(85, 0.25), 35, 180)
                strokes.push({
                    key,
                    delay: Math.round(Math.max(8, gap - previousHold)),
                    hold: Math.round(hold),
                })
                previousHold = hold
            }

            const gapFor = (char: string, previous: string | undefined): number => {
                let gap = random.logNormal(interval * 0.92, variance)
                if (previous) {
                    const pair = (previous + char).toLowerCase()
                    if (FAST_PAIRS.has(pair)) gap *= 0.75
                    else if (previous === char) gap *= 0.85
                    if (previous === ' ' && random.chance(0.12)) gap += random.range(120, 450)
                    if (SENTENCE_END.test(previous) && char === ' ') gap += random.range(150, 500)
                }
                if (needsShift(char)) gap *= 1.25
                if (/[0-9]/.test(char)) gap *= 1.15
                return clamp(gap, 25, interval * 8)
            }

            for (let i = 0; i < chars.length; i++) {
                const char = chars[i] as string
                const previous = chars[i - 1]
                const lower = char.toLowerCase()
                const near = NEIGHBOURS[lower]

                if (typos > 0 && near && random.chance(typos)) {
                    // Hit a neighbouring key, sometimes type one more letter before noticing,
                    // pause, then Backspace back and type it right.
                    const wrong = random.pick([...near])
                    push(char === lower ? wrong : wrong.toUpperCase(), gapFor(char, previous))
                    const next = chars[i + 1]
                    const typedOn = !!next && /[a-z]/i.test(next) && random.chance(0.3)
                    if (typedOn) push(next, gapFor(next, char))
                    push('Backspace', random.range(220, 520))
                    if (typedOn) push('Backspace', random.range(90, 160))
                    push(char, random.range(110, 200))
                    continue
                }

                push(char, i === 0 ? random.range(30, 120) : gapFor(char, previous))
            }
            return strokes
        },
    }
}

/** Identity helper so TypeScript checks and autocompletes a custom typing strategy. */
export const defineTyping = <T extends TypingStrategy>(strategy: T): T => strategy
