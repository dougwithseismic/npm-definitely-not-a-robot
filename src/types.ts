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
    startX?: number
    startY?: number
    target?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    endX?: number
    endY?: number
    jitterMin?: number
    jitterMax?: number
    jitterCount?: number
}

// Function type for debug visualization of mouse positions.
export type DebugShowPositionFunction = (page: Page, x: number, y: number) => Promise<void>

export type DebugOptions = {
    fadeDuration?: number // Duration (in ms) before the debug visuals fade away. If not provided, they won't fade.
}

export interface CustomWindow extends Window {
    debugCanvas: HTMLCanvasElement | undefined
    debugCanvasCtx: CanvasRenderingContext2D
}


export interface MouseState {
    x: number
    y: number
}



export interface Point {
    x: number;
    y: number;
}

export interface SegmentDeltas {
    segmentDxs: number[];
    segmentDys: number[];
}

export interface MovementCalculations {
    speed: number;
    acceleration: number;
}
