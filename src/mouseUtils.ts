import { Page, ElementHandle } from 'puppeteer'
import { debugShowPosition, debugDrawLine } from './debugUtils'
import { MovementOptions } from './types'

const defaultOptions: MovementOptions = {
    scrollBeforeMove: true,
    variablePath: true,
    hesitationBeforeClick: true,
    maxPause: 500,
    minPause: 100,
    debug: false,
    fadeDuration: 3000, // This can be adjusted or made optional.
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
    // Merge the provided options with the default options.
    options = { ...defaultOptions, ...options }

    // Fetch the bounding box of the element.
    const box = await element.boundingBox()

    if (!box) {
        throw new Error('Failed to fetch the bounding box of the element.')
    }
    // Check page exists.
    if (!page) {
        throw new Error('Page is not defined.')
    }

    const viewport = page.viewport()
    if (!viewport) {
        console.log('viewport :>> ', viewport)
        throw new Error('Viewport is not defined.')
    }

    const startX = Math.random() * viewport.width
    const startY = Math.random() * viewport.height
    const endX = box.x + box.width / 2 + (Math.random() * 20 - 10)
    const endY = box.y + box.height / 2 + (Math.random() * 20 - 10)

    if (options.scrollBeforeMove) {
        await page.evaluate(
            (y) => {
                window.scrollBy(0, y)
            },
            endY - viewport.height / 2
        )
        await randomPause(page, options.minPause!, options.maxPause!)
    }

    if (options.debug) {
        await debugShowPosition(page, startX, startY, { fadeDuration: options.fadeDuration })
    }

    await page.mouse.move(startX, startY)
    await randomPause(page, options.minPause!, options.maxPause!)

    if (options.variablePath) {
        const midX = (startX + endX) / 2 + (Math.random() * 20 - 10)
        const midY = (startY + endY) / 2 + (Math.random() * 20 - 10)

        if (options.debug) {
            await debugDrawLine(page, startX, startY, midX, midY, {
                fadeDuration: options.fadeDuration,
            })
            await debugShowPosition(page, midX, midY, { fadeDuration: options.fadeDuration })
        }

        await page.mouse.move(midX, midY)
        await randomPause(page, options.minPause!, options.maxPause!)
    }

    if (options.debug) {
        await debugDrawLine(
            page,
            options.variablePath ? (startX + endX) / 2 : startX,
            options.variablePath ? (startY + endY) / 2 : startY,
            endX,
            endY,
            { fadeDuration: options.fadeDuration }
        )
        await debugShowPosition(page, endX, endY, { fadeDuration: options.fadeDuration })
    }

    if (options.hesitationBeforeClick) {
        await randomPause(page, options.minPause!, options.maxPause!)
    }

    await page.mouse.click(endX, endY, { delay: 50 + Math.random() * 100 })
}
