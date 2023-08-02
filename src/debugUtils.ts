import { Page } from 'puppeteer'
import { CustomWindow, DebugOptions, MovementOptions } from './types'

declare const window: CustomWindow

function createDebugElement(style: Partial<CSSStyleDeclaration>): HTMLElement {
    const elem = document.createElement('div')
    Object.assign(elem.style, style)
    elem.style.zIndex = '999999'
    document.body.appendChild(elem)
    return elem
}

export async function initDebugCanvas(page: Page) {
    return page.evaluate(() => {
        if (window.debugCanvas) {
            return
        }

        const canvas = document.createElement('canvas')
        Object.assign(canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            pointerEvents: 'none',
            zIndex: '999999',
        })

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        window.debugCanvas = canvas
        window.debugCanvasCtx = canvas.getContext('2d')!
        document.body.appendChild(canvas)
    })
}

export async function debugShowPosition(page: Page, x: number, y: number, options?: DebugOptions) {
    return page.evaluate(
        (x, y, options) => {
            const dot = createDebugElement({
                position: 'absolute',
                width: '2px',
                height: '2px',
                borderRadius: '50%',
                backgroundColor: 'red',
                transform: 'translate(-50%, -50%)',
                left: `${x}px`,
                top: `${y}px`,
            })

            if (options?.fadeDuration) {
                setTimeout(() => dot.remove(), options.fadeDuration)
            }
        },
        x,
        y,
        options
    )
}

export async function debugDrawSegment(
    page: Page,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: MovementOptions
) {
    await page.evaluate(
        (startX, startY, endX, endY, options) => {
            const ctx = (window as any).debugCanvasCtx
            if (!ctx) return

            ctx.strokeStyle = '#FF0000' // Color of the curve
            ctx.lineWidth = 2

            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.lineTo(endX, endY)
            ctx.stroke()

            if (options.fadeDuration) {
                setTimeout(() => {
                    const padding = 2 // To ensure the line is fully covered
                    const x = Math.min(startX, endX) - padding
                    const y = Math.min(startY, endY) - padding
                    const width = Math.abs(endX - startX) + 2 * padding
                    const height = Math.abs(endY - startY) + 2 * padding

                    ctx.clearRect(x, y, width, height)
                }, options.fadeDuration)
            }
        },
        startX,
        startY,
        endX,
        endY,
        options
    )
}
