import { chromium } from 'playwright'
import { createHuman } from 'definitely-not-a-robot'

// Three sessions that move like visitors, each with its own seed, against a page you own. The
// counter stands in for your analytics: point this at your staging site and check what your
// heatmap, session replay or bot rules recorded. Run a seed again to get that session again.
const browser = await chromium.launch()
for (const seed of [1, 2, 3]) {
    const page = await browser.newPage()
    await page.addInitScript(() => {
        window.seen = { pointermove: 0, click: 0, keydown: 0 }
        for (const type of Object.keys(window.seen)) {
            addEventListener(type, () => window.seen[type]++, true)
        }
    })
    await page.goto('https://demo.playwright.dev/todomvc')

    const human = createHuman(page, { seed })
    await human.type('.new-todo', 'Check the heatmap')
    await human.press('Enter')
    await human.click('.toggle')

    console.log(`seed ${seed}`, await page.evaluate(() => window.seen))
    await page.close()
}
await browser.close()
