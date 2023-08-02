import { Page } from 'puppeteer'

// Options for controlling mouse movement behavior.
export type MovementOptions = {
    scrollBeforeMove?: boolean
    variablePath?: boolean
    hesitationBeforeClick?: boolean
    maxPause?: number
    minPause?: number
    debug?: boolean
    fadeDuration?: number
}

// Function type for debug visualization of mouse positions.
export type DebugShowPositionFunction = (page: Page, x: number, y: number) => Promise<void>

export type DebugOptions = {
    fadeDuration?: number // Duration (in ms) before the debug visuals fade away. If not provided, they won't fade.
}
