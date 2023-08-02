import { Browser, Page, BrowserLaunchArgumentOptions, KeyInput } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { drawBezierMovement, humanMouseMove } from './mouseUtils'
import { MovementOptions } from './types'

puppeteer.use(StealthPlugin())

const DEFAULT_VIEWPORT = {
    width: 1280,
    height: 960,
}

export class BrowserNotInitializedError extends Error {
    constructor() {
        super('Browser or page is not initialized. Please launch it first.')
    }
}

export class ElementNotFoundError extends Error {
    constructor(selector: string) {
        super(`Element with selector "${selector}" not found.`)
    }
}

class HumanBrowser {
    private browser?: Browser
    private lastMousePosition: { x: number; y: number } = { x: 0, y: 0 }
    public page?: Page

    constructor(private puppeteerBrowser = puppeteer) {
        this.puppeteerBrowser = puppeteerBrowser
        this.puppeteerBrowser.use(StealthPlugin())
    }

    async launch(options?: BrowserLaunchArgumentOptions) {
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: DEFAULT_VIEWPORT,
            ...options,
        })

        this.page = await this.browser.newPage()
    }

    async navigate(url: string) {
        if (!this.page) {
            throw new Error('Page is not initialized. Call launch() first.')
        }
        await this.page.goto(url)
    }

    async moveToElement(selector: string, moveOptions?: MovementOptions) {
        if (!this.page) {
            throw new Error('Page is not initialized. Call launch() first.')
        }
        const element = await this.page.$(selector)
        if (!element) {
            throw new Error(`Element with selector "${selector}" not found.`)
        }

        const boundingBox = await element.boundingBox()
        if (!boundingBox) {
            throw new Error(`Failed to get bounding box for element with selector "${selector}".`)
        }

        let endX = boundingBox.x + boundingBox.width / 2
        let endY = boundingBox.y + boundingBox.height / 2

        const { x: startX, y: startY } = this.lastMousePosition
        const { x, y } = await humanMouseMove(this.page, element, {
            startX,
            startY,
            endX,
            endY,
            ...moveOptions,
        })

        // Remember the new position
        this.lastMousePosition = { x, y }
    }

    async jitterMouse(options: MovementOptions = {}): Promise<void> {
        if (!this.page) {
            throw new Error('Page is not initialized. Call launch() first.')
        }

        const jitterMin = options.jitterMin ?? 20
        const jitterMax = options.jitterMax ?? 95
        const jitterCount = options.jitterCount ?? 1 // default to one jitter

        for (let i = 0; i < jitterCount; i++) {
            const jitterAmount = Math.random() * (jitterMax - jitterMin) + jitterMin
            const jitterX =
                this.lastMousePosition.x + (Math.random() * jitterAmount - jitterAmount / 2)
            const jitterY =
                this.lastMousePosition.y + (Math.random() * jitterAmount - jitterAmount / 2)

            // Use the drawBezierMovement function to draw the jitter movement
            await drawBezierMovement(
                this.page,
                this.lastMousePosition.x,
                this.lastMousePosition.y,
                jitterX,
                jitterY,
                options
            )

            this.lastMousePosition = { x: jitterX, y: jitterY }

            // Optionally, you can introduce a pause between jitters for more realistic movement
            await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 100))
        }
    }
    async humanType(text: string, wpm: number = 250) {
        if (!this.page) {
            throw new Error('Page is not initialized. Call launch() first.')
        }

        const words = text.split(/\s+/)
        const totalChars = text.length
        const totalWords = words.length
        const totalTimeToType = (totalWords / wpm) * 60 * 1000 // Total time in milliseconds
        const averageDelayPerChar = totalTimeToType / totalChars

        const diffMultiplier = 2

        for (let i = 0; i < text.length; i++) {
            const char = text[i] as KeyInput
            await this.page.keyboard.press(char)

            let delay = averageDelayPerChar

            if (i > 0) {
                // Adjust delay based on the ASCII difference between current and previous character
                const diff = Math.abs(text.charCodeAt(i) - text.charCodeAt(i - 1))
                // Add a variable delay based on ASCII difference, the multiplier can be adjusted
                delay += diff * diffMultiplier
            }

            // Add a longer pause after sentence-ending punctuation
            if (['.', '!', '?'].includes(char)) {
                delay += 200 // 200ms pause after punctuation
            }

            await new Promise((res) => setTimeout(res, delay))
        }
    }

    async wait(minMs: number = 0, maxMs: number = 0): Promise<void> {
        const delay = Math.random() * (maxMs - minMs) + minMs
        await new Promise((r) => setTimeout(r, delay))
    }

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close()
        }
    }
}

export default HumanBrowser
