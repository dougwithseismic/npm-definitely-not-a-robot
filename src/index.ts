export type { PlaywrightPageLike } from './drivers/playwright'
export { playwrightDriver } from './drivers/playwright'
export type { Driver, ElementRef, HitTest, MouseButton, ScrollOffset } from './drivers/types'
export { defineDriver } from './drivers/types'
export type { HumanErrorCode } from './errors'
export { HumanError } from './errors'
export type { Box, Point, Size, TimedPoint } from './geometry'
export type {
    ClickOptions,
    Human,
    HumanOptions,
    MoveOptions,
    ScrollOptions,
    Target,
    TypeOptions,
} from './human'
export { createHuman } from './human'
export type { BezierMotionOptions, MotionRequest, MotionStrategy } from './motion'
export { bezierMotion, defineMotion } from './motion'
export type { Action, ActionType, HumanPlugin, PluginContext } from './plugins'
export { definePlugin } from './plugins'
export type { TrailOptions, VisibleCursorOptions } from './plugins/overlay'
export { trail, visibleCursor } from './plugins/overlay'
export type { Preset, PresetName, Timing } from './presets'
export { defaultTiming, definePreset, presets } from './presets'
export type { Random } from './random'

export { createRandom } from './random'
export type { ScrollRequest, ScrollStrategy, WheelScrollOptions, WheelStep } from './scroll'
export { defineScroll, wheelScroll } from './scroll'
export type { Keystroke, NaturalTypingOptions, TypingRequest, TypingStrategy } from './typing'
export { defineTyping, naturalTyping } from './typing'
