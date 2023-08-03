import { Page, ElementHandle, Point } from 'puppeteer'
import { initDebugCanvas, debugDrawSegment } from './debugUtils'
import { MouseState, MovementCalculations, MovementOptions } from './types'

const defaultOptions: MovementOptions = {
    scrollBeforeMove: true,
    variablePath: true,
    hesitationBeforeClick: true,
    maxPause: 1,
    minPause: 0,
    debug: true,
    fadeDuration: 500,
}

const mouseState: MouseState = {
    x: 0,
    y: 0,
}

const JITTER_DISTANCE = 3
const MIN_JITTER_COUNT = 1
const MAX_JITTER_COUNT = 5

const BUFFER = 20
const MIN_SEGMENTS = 2
const MAX_SEGMENTS = 50
const CLICK_DELAY_MIN = 50
const CLICK_DELAY_MAX = 150

async function randomPause(page: Page, min: number, max: number) {
    const delay = Math.random() * (max - min) + min
    await new Promise((r) => setTimeout(r, delay))
}

function getEndCoordinates(box: any, target: string | undefined): { x: number; y: number } {
    switch (target) {
        case 'top-left':
            return { x: box.x + Math.random() * BUFFER, y: box.y + Math.random() * BUFFER }
        case 'top-right':
            return {
                x: box.x + box.width - Math.random() * BUFFER,
                y: box.y + Math.random() * BUFFER,
            }
        case 'bottom-left':
            return {
                x: box.x + Math.random() * BUFFER,
                y: box.y + box.height - Math.random() * BUFFER,
            }
        case 'bottom-right':
            return {
                x: box.x + box.width - Math.random() * BUFFER,
                y: box.y + box.height - Math.random() * BUFFER,
            }
        default:
            return { x: box.x + Math.random() * box.width, y: box.y + Math.random() * box.height }
    }
}

export async function humanMouseMove(
    page: Page,
    element: ElementHandle<Element>,
    options: MovementOptions = defaultOptions
) {
    options = { ...defaultOptions, ...options }

    const box = await element.boundingBox()
    if (!box) throw new Error('Failed to fetch the bounding box of the element.')

    const viewport = page.viewport()
    if (!viewport) throw new Error('Viewport is not defined.')

    const startX = options.startX ?? Math.random() * viewport.width
    const startY = options.startY ?? Math.random() * viewport.height

    const { x: endX, y: endY } = getEndCoordinates(box, options.target)

    // await drawBezierMovement(page, startX, startY, endX, endY, options)
    await drawBezierMovementWithJitter(page, startX, startY, endX, endY, options)

    if (options.hesitationBeforeClick) {
        await randomPause(page, options.minPause!, options.maxPause!)
    }

    const clickDelay = CLICK_DELAY_MIN + Math.random() * (CLICK_DELAY_MAX - CLICK_DELAY_MIN)
    await page.mouse.click(endX, endY, { delay: clickDelay })

    return { x: endX, y: endY }
}

function calculateDistance(start: Point, end: Point): number {
    return Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
}

function calculateSpeed(distance: number): number {
    const BASE_SPEED = 0.03 // you can adjust this as required
    return BASE_SPEED + distance * 0.001
}

function calculateAcceleration(distance: number): number {
    return 0.002 // constant acceleration
}

function computeMovementCalculations(start: Point, end: Point): MovementCalculations {
    const distance = calculateDistance(start, end)
    return {
        speed: calculateSpeed(distance),
        acceleration: calculateAcceleration(distance),
    }
}

function computeBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
    const u = 1 - t
    const tt = t * t
    const uu = u * u
    return uu * u * p0 + 3 * uu * t * p1 + 3 * u * tt * p2 + tt * t * p3
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
}

export async function drawBezierMovement(
    page: Page,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: MovementOptions
): Promise<void> {
    const ctrlPt1X = startX + Math.random() * (endX - startX) * 0.5;
    const ctrlPt1Y = startY + Math.random() * (endY - startY) * 0.5;
    const ctrlPt2X = endX - Math.random() * (endX - startX) * 0.5;
    const ctrlPt2Y = endY - Math.random() * (endY - startY) * 0.5;

    if (options.debug) {
        await initDebugCanvas(page);
    }

    const distance = calculateDistance({x: startX, y: startY}, {x: endX, y: endY});
    const segments = Math.max(MIN_SEGMENTS, Math.min(MAX_SEGMENTS, Math.floor(distance / 10)));
    const { speed, acceleration } = computeMovementCalculations({ x: startX, y: startY }, { x: endX, y: endY });

    let prevX = startX;
    let prevY = startY;
    for (let i = 0; i <= segments; i++) {
        let t = i / segments;
        
        t += speed + 0.5 * acceleration * t * t;
        t = Math.min(t, 1);
        
        const x = computeBezier(t, startX, ctrlPt1X, ctrlPt2X, endX);
        const y = computeBezier(t, startY, ctrlPt1Y, ctrlPt2Y, endY);

        await page.mouse.move(x, y);

        if (options.debug) {
            await debugDrawSegment(page, prevX, prevY, x, y, options);
        }

        prevX = x;
        prevY = y;

        const easedT = easeInOutCubic(t);
        const adjustedPause = options.minPause! + (options.maxPause! - options.minPause!) * easedT;

        await randomPause(page, adjustedPause, adjustedPause + 10);
    }
}

function splitDistance(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    maxSegmentLength: number
) {
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
    const segments = Math.ceil(distance / maxSegmentLength)

    const segmentDxs = []
    const segmentDys = []

    let currentX = startX
    let currentY = startY

    for (let i = 1; i <= segments; i++) {
        let nextX = currentX + (endX - startX) / segments
        let nextY = currentY + (endY - startY) / segments

        segmentDxs.push(nextX - currentX)
        segmentDys.push(nextY - currentY)

        currentX = nextX
        currentY = nextY
    }

    return { segmentDxs, segmentDys }
}

async function introduceJitter(page: Page, options: MovementOptions, jitterCount: number) {
    for (let i = 0; i < jitterCount; i++) {
        const angle = Math.random() * 2 * Math.PI
        const distance = JITTER_DISTANCE * Math.random()

        const prevX = mouseState.x
        const prevY = mouseState.y

        const dx = distance * Math.cos(angle)
        const dy = distance * Math.sin(angle)

        mouseState.x = prevX + dx
        mouseState.y = prevY + dy

        await page.mouse.move(mouseState.x, mouseState.y)

        if (options.debug) {
            await debugDrawSegment(page, prevX, prevY, mouseState.x, mouseState.y, options)
        }

        // Random pause between each jitter
        await randomPause(page, 0, 50)

        // Move the mouse back
        mouseState.x = prevX
        mouseState.y = prevY

        await page.mouse.move(prevX, prevY)

        // Random pause between returning from jitter and next jitter
        await randomPause(page, 10, 200)
    }
}

export async function drawBezierMovementWithJitter(
    page: Page,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: MovementOptions | undefined
) {
    options = { ...defaultOptions, ...options }
    mouseState.x = startX
    mouseState.y = startY

    const viewport = page.viewport()
    if (!viewport) throw new Error('Viewport is not defined.')

    const majorMovement =
        Math.abs(endX - startX) > Math.abs(endY - startY) ? 'horizontal' : 'vertical'
    const maxSegmentLength =
        majorMovement === 'horizontal' ? viewport.width * 0.6 : viewport.height * 0.6

    const { segmentDxs, segmentDys } = splitDistance(startX, startY, endX, endY, maxSegmentLength)

    let currentX = startX
    let currentY = startY

    for (let i = 0; i < segmentDxs.length; i++) {
        await drawBezierMovement(
            page,
            currentX,
            currentY,
            currentX + segmentDxs[i],
            currentY + segmentDys[i],
            options
        )

        currentX += segmentDxs[i]
        currentY += segmentDys[i]

        mouseState.x = currentX
        mouseState.y = currentY

        if (i < segmentDxs.length - 1) {
            const jitterCount = Math.floor(
                Math.random() * (MAX_JITTER_COUNT - MIN_JITTER_COUNT + 1) + MIN_JITTER_COUNT
            )
            await introduceJitter(page, options, jitterCount)
        }
    }
}
