import { Page, ElementHandle } from 'puppeteer'
import { initDebugCanvas, debugDrawSegment } from './debugUtils'
import { MovementOptions } from './types'

const defaultOptions: MovementOptions = {
    scrollBeforeMove: true,
    variablePath: true,
    hesitationBeforeClick: true,
    maxPause: 1,
    minPause: 0,
    debug: true,
    fadeDuration: 500, // This can be adjusted or made optional.
}

// Generates a random pause duration based on min and max values
async function randomPause(page: Page, min: number, max: number) {
    const delay = Math.random() * (max - min) + min
    await new Promise((r) => setTimeout(r, delay))
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

    // Define a buffer of 20 pixels (or any desired value)
    const buffer = 20

    let endX, endY
    if (options.target) {
        switch (options.target) {
            case 'top-left':
                endX = box.x + Math.random() * buffer
                endY = box.y + Math.random() * buffer
                break
            case 'top-right':
                endX = box.x + box.width - Math.random() * buffer
                endY = box.y + Math.random() * buffer
                break
            case 'bottom-left':
                endX = box.x + Math.random() * buffer
                endY = box.y + box.height - Math.random() * buffer
                break
            case 'bottom-right':
                endX = box.x + box.width - Math.random() * buffer
                endY = box.y + box.height - Math.random() * buffer
                break
            default:
                endX = box.x + Math.random() * box.width
                endY = box.y + Math.random() * box.height
                break
        }
    } else {
        const offsetX = Math.random() * box.width
        const offsetY = Math.random() * box.height
        endX = box.x + offsetX
        endY = box.y + offsetY
    }

    await drawBezierMovement(page, startX, startY, endX, endY, options)

    if (options.hesitationBeforeClick) {
        // @ts-ignore
        await randomPause(page, options.minPause, options.maxPause)
    }

    await page.mouse.click(endX, endY, { delay: 50 + Math.random() * 100 })

    return { x: endX, y: endY }
}
// Helper function to compute cubic Bezier curve position
function computeBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
    const u = 1 - t
    const tt = t * t
    const uu = u * u
    const uuu = uu * u
    const ttt = tt * t
    return uuu * p0 + 3 * uu * t * p1 + 3 * u * tt * p2 + ttt * p3
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
) {
    options = { ...defaultOptions, ...options }

    const ctrlPt1X = startX + Math.random() * (endX - startX) * 0.5
    const ctrlPt1Y = startY + Math.random() * (endY - startY) * 0.5
    const ctrlPt2X = endX - Math.random() * (endX - startX) * 0.5
    const ctrlPt2Y = endY - Math.random() * (endY - startY) * 0.5

    if (options.debug) {
        await initDebugCanvas(page)
    }

    let segments = Math.floor(
        Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) / 10
    )

    segments = Math.max(2, Math.min(50, segments))

    let prevX = startX
    let prevY = startY
    for (let i = 0; i <= segments; i++) {
        const t = i / segments
        const x = computeBezier(t, startX, ctrlPt1X, ctrlPt2X, endX)
        const y = computeBezier(t, startY, ctrlPt1Y, ctrlPt2Y, endY)

        await page.mouse.move(x, y)

        if (options.debug) {
            await debugDrawSegment(page, prevX, prevY, x, y, options)
        }

        prevX = x
        prevY = y

        const minPause = options.minPause!
        const maxPause = options.maxPause!

        const easedT = easeInOutCubic(t)
        const adjustedPause = minPause + (maxPause - minPause) * easedT

        await randomPause(page, adjustedPause, adjustedPause + 10)
    }
}
