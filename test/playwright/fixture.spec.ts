import { test as base, mergeTests } from '@playwright/test'
import { expect, test } from '../../src/playwright'

const form = `<body style="margin:0">
    <button id="go" style="position:absolute;left:900px;top:500px;padding:12px">Go</button>
    <script>document.getElementById('go').onclick = (e) => { window.clicked = e.isTrusted }</script>
</body>`

test('gives every test a human for its own page', async ({ page, human }) => {
    expect(human.page).toBe(page)
    await page.setContent(form)
    await human.click('#go')
    expect(await page.evaluate(() => (window as any).clicked)).toBe(true)
})

test.describe('in CI', () => {
    test.use({ humanOptions: { startPosition: { x: 100, y: 100 } } })
    // Set before each test's human is made, and put back afterwards. Nothing reads CI: this checks
    // that being in CI doesn't change the speed on its own.
    const saved = { CI: process.env.CI, DNAR_SPEED: process.env.DNAR_SPEED }
    test.beforeAll(() => {
        process.env.CI = '1'
        delete process.env.DNAR_SPEED
    })
    test.afterAll(() => {
        for (const [key, value] of Object.entries(saved)) {
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
        }
    })

    test('moves at human speed unless DNAR_SPEED says otherwise', async ({ page, human }) => {
        await page.setContent(form)
        const started = Date.now()
        await human.move({ x: 1100, y: 600 })
        // A person takes most of a second for that; instant mode about a tenth of one.
        expect(Date.now() - started).toBeGreaterThan(400)
    })
})

test.describe('with test.use({ humanOptions })', () => {
    test.use({ humanOptions: { preset: 'demo', seed: 42, speed: 'instant' } })

    test('makes the human with those options', async ({ page, human }) => {
        expect(human.seed).toBe(42)
        await page.setContent(form)
        await human.move({ x: 300, y: 300 })
        const drawn = await page.evaluate(
            () => Symbol.for('definitely-not-a-robot.overlay') in window
        )
        expect(drawn).toBe(true)
    })
})

const withGreeting = base.extend<{ greeting: string }>({ greeting: 'hello' })

mergeTests(withGreeting, test)('merges with your own fixtures', async ({ greeting, human }) => {
    expect(greeting).toBe('hello')
    expect(typeof human.click).toBe('function')
})
