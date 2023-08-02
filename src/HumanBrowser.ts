import { Browser, Page, BrowserLaunchArgumentOptions } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { humanMouseMove } from './mouseUtils'
import { MovementOptions } from './types'

puppeteer.use(StealthPlugin())

class HumanBrowser {
    private browser?: Browser
    public page?: Page

    async launch(options?: BrowserLaunchArgumentOptions) {
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: {
                width: 1280,
                height: 720,
            },
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

    async humanMoveAndClick(selector: string, moveOptions?: MovementOptions) {
        if (!this.page) {
            throw new Error('Page is not initialized. Call launch() first.')
        }
        const element = await this.page.$(selector)
        if (!element) {
            throw new Error(`Element with selector "${selector}" not found.`)
        }
        await humanMouseMove(this.page, element, moveOptions)
    }

    async close() {
        if (this.browser) {
            await this.browser.close()
        }
    }
}

export default HumanBrowser
