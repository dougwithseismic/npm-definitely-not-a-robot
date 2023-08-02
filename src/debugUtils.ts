import { Page } from 'puppeteer'
import { DebugOptions } from './types'

export async function debugShowPosition(page: Page, x: number, y: number, options?: DebugOptions) {
    await page.evaluate(
        (x, y, options) => {
            const dot = document.createElement('div')
            dot.style.position = 'absolute'
            dot.style.width = '10px'
            dot.style.height = '10px'
            dot.style.borderRadius = '50%'
            dot.style.backgroundColor = 'red'
            dot.style.transform = 'translate(-50%, -50%)'
            dot.style.left = `${x}px`
            dot.style.top = `${y}px`
            dot.style.zIndex = '999999'
            document.body.appendChild(dot)

            if (options && options.fadeDuration) {
                setTimeout(() => {
                    dot.remove()
                }, options.fadeDuration)
            }
        },
        x,
        y,
        options
    )
}

export async function debugDrawLine(
    page: Page,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options?: DebugOptions
) {
    await page.evaluate(
        (startX, startY, endX, endY, options) => {
            const line = document.createElement('div')
            const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2)
            const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI

            line.style.position = 'absolute'
            line.style.width = `${1}px`
            line.style.height = '2px'
            line.style.backgroundColor = 'blue'
            line.style.transformOrigin = '0% 0%'
            line.style.transform = `rotate(${angle}deg)`
            line.style.left = `${startX}px`
            line.style.top = `${startY}px`
            line.style.zIndex = '999998'
            document.body.appendChild(line)

            if (options && options.fadeDuration) {
                setTimeout(() => {
                    line.remove()
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
