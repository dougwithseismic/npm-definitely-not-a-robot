import { chromium } from 'playwright'
import { createHuman } from 'definitely-not-a-robot'

const browser = await chromium.launch({ headless: false })
const page = await browser.newPage()
await page.goto('https://demo.playwright.dev/todomvc')

const human = createHuman(page)
await human.type('.new-todo', 'Buy milk')
await human.press('Enter')
await human.click('.toggle')

await browser.close()
