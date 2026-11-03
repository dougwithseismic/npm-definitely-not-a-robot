import type { BezierMotionOptions, MotionStrategy } from './motion'
import type { HumanPlugin } from './plugins'
import { visibleCursor } from './plugins/overlay'
import type { ScrollStrategy, WheelScrollOptions } from './scroll'
import type { NaturalTypingOptions, TypingStrategy } from './typing'

/** Pauses around actions, each a [min, max] range in ms. */
export interface Timing {
    /** After the cursor arrives, before pressing. */
    hesitation: [min: number, max: number]
    /** How long `hover()` lingers. */
    hoverDwell: [min: number, max: number]
    /** What `pause()` waits with no arguments: reading, thinking. */
    think: [min: number, max: number]
    /** How long a mouse button stays down in a click. */
    clickHold: [min: number, max: number]
    /** Between the two clicks of a double-click. */
    doubleClickGap: [min: number, max: number]
}

/**
 * A named bundle of behaviour. Any option you pass to `createHuman` overrides the preset. Plugins
 * add to the preset's, and one with the same name replaces it.
 */
export interface Preset {
    motion?: MotionStrategy | BezierMotionOptions
    typing?: TypingStrategy | NaturalTypingOptions
    scroll?: ScrollStrategy | WheelScrollOptions
    timing?: Partial<Timing>
    plugins?: HumanPlugin[]
}

export const defaultTiming: Timing = {
    hesitation: [60, 220],
    hoverDwell: [180, 450],
    think: [400, 1400],
    clickHold: [55, 130],
    doubleClickGap: [70, 140],
}

const average: Preset = {}

const careful: Preset = {
    motion: { fitts: { a: 120, b: 190 }, curvature: 0.25 },
    typing: { wpm: 42, variance: 0.3 },
    timing: { hesitation: [200, 500], hoverDwell: [350, 800], think: [900, 2500] },
}

const fast: Preset = {
    motion: { fitts: { a: 60, b: 100 }, curvature: 0.18 },
    typing: { wpm: 95, variance: 0.3 },
    timing: {
        hesitation: [30, 110],
        hoverDwell: [100, 250],
        think: [150, 600],
        clickHold: [40, 90],
    },
}

/** For recordings: smooth, unhurried, readable, with the cursor drawn. */
const demo: Preset = {
    motion: { fitts: { a: 110, b: 170 }, curvature: 0.2, overshoot: 0.15, tremor: 0 },
    typing: { wpm: 50, variance: 0.15 },
    timing: {
        hesitation: [220, 380],
        hoverDwell: [600, 900],
        think: [700, 1200],
        clickHold: [110, 160],
    },
    // Recordings are usually shown smaller than they're filmed, so a slightly larger arrow.
    plugins: [visibleCursor({ size: 28 })],
}

export const presets = { average, careful, fast, demo } satisfies Record<string, Preset>

export type PresetName = keyof typeof presets

/** Identity helper so TypeScript checks and autocompletes a custom preset. */
export const definePreset = <T extends Preset>(preset: T): T => preset
