import { chromium } from 'playwright'
import { createHuman } from 'definitely-not-a-robot'

const browser = await chromium.launch()
const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: 'videos', size: { width: 1280, height: 720 } },
})
const page = await context.newPage()
await page.goto('https://demo.playwright.dev/todomvc')

const human = createHuman(page, { preset: 'demo' })
await human.type('.new-todo', 'Record the launch video')
await human.press('Enter')
await human.click('.toggle')
await human.pause()

await context.close() // the video is written when the context closes
console.log('Saved', await page.video().path())
await browser.close()
