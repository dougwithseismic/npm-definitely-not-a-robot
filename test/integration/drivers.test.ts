import { chromium } from 'playwright'
import puppeteer from 'puppeteer-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
    createHuman,
    type PlaywrightPageLike,
    type PuppeteerPageLike,
    visibleCursor,
} from '../../src'
import { isInside } from '../../src/geometry'
import {
    BROWSER,
    FIXTURE_HTML,
    failure,
    fast,
    launch,
    openFixture,
    type RecordedEvent,
    VIEWPORT,
} from './fixture'

// The same checks on every built-in driver. Puppeteer drives Playwright's Chromium, so no second
// browser download is needed, and runs only when the tests do (not with DNAR_BROWSER=firefox).

/** What these tests use from a page, which Playwright and Puppeteer pages share. */
type AnyPage = (Omit<PlaywrightPageLike, 'evaluate'> | Omit<PuppeteerPageLike, 'evaluate'>) & {
    evaluate<T, A>(fn: (arg: A) => T, arg?: A): Promise<T>
    $(selector: string): Promise<unknown>
    close(): Promise<void>
}

/** Each backend opens the fixture page at the same size. */
const backends = {
    async playwright() {
        const browser = await launch()
        return {
            open: async () => (await openFixture(browser)) as AnyPage,
            close: () => browser.close(),
        }
    },
    async puppeteer() {
        const browser = await puppeteer.launch({
            executablePath: chromium.executablePath(),
            defaultViewport: VIEWPORT,
        })
        return {
            async open() {
                const page = await browser.newPage()
                await page.setContent(FIXTURE_HTML)
                return page as unknown as AnyPage
            },
            close: () => browser.close(),
        }
    },
}

const running = Object.entries(backends).filter(
    ([name]) => name === 'playwright' || BROWSER === 'chromium'
)

describe.each(running)('on %s', (name, start) => {
    let backend: Awaited<ReturnType<typeof start>>
    beforeAll(async () => {
        backend = await start()
    })
    afterAll(() => backend?.close())

    /** A fresh fixture page for `test`, closed afterwards. */
    async function onFixture(test: (page: AnyPage) => Promise<void>): Promise<void> {
        const page = await backend.open()
        try {
            await test(page)
        } finally {
            await page.close()
        }
    }

    const events = (page: AnyPage) =>
        page.evaluate(() => (window as unknown as { events: RecordedEvent[] }).events)
    const box = (page: AnyPage, selector: string) =>
        page.evaluate((s) => {
            const r = document.querySelector(s)!.getBoundingClientRect()
            return { x: r.x, y: r.y, width: r.width, height: r.height }
        }, selector)

    it('clicks along a path, inside the target', () =>
        onFixture(async (page) => {
            const human = createHuman(page, {
                speed: 3,
                seed: 1,
                startPosition: { x: 100, y: 700 },
            })
            await human.click('#signup')
            const log = await events(page)
            // A path, not one jump. The count varies: a busy machine drops points to keep to time.
            expect(log.filter((e) => e.type === 'mousemove').length).toBeGreaterThan(3)
            expect(
                isInside(log.find((e) => e.type === 'mousedown')!, await box(page, '#signup'))
            ).toBe(true)
            expect(log.find((e) => e.type === 'click')?.target).toBe('signup')
        }))

    it('double-clicks and right-clicks', () =>
        onFixture(async (page) => {
            const human = createHuman(page, fast)
            await human.doubleClick('#signup')
            await human.click('#email', { button: 'right' })
            const log = await events(page)
            expect(log.find((e) => e.type === 'dblclick')?.target).toBe('signup')
            expect(log.filter((e) => e.type === 'click').map((e) => e.detail)).toEqual([1, 2])
            expect(log.find((e) => e.type === 'contextmenu')?.target).toBe('email')
        }))

    it('hovers to open a menu, then clicks in it', () =>
        onFixture(async (page) => {
            const human = createHuman(page, fast)
            await human.hover('#menu')
            await human.click('#menu-item')
            expect((await events(page)).find((e) => e.type === 'click')?.target).toBe('menu-item')
        }))

    it('drags with the button held the whole way', () =>
        onFixture(async (page) => {
            // Instant speed keeps every point while a button is held, so this count doesn't vary.
            await createHuman(page, fast).drag('#source', '#dropzone')
            const log = await events(page)
            const down = log.findIndex((e) => e.type === 'mousedown')
            const up = log.findIndex((e) => e.type === 'mouseup')
            expect(
                log.slice(down, up).filter((e) => e.type === 'mousemove').length
            ).toBeGreaterThan(10)
            expect(await page.evaluate(() => (window as any).dropped)).toBe(true)
        }))

    it('types with Shift for capitals, inserts what has no key, and adds to what is there', () =>
        onFixture(async (page) => {
            const human = createHuman(page, fast)
            await human.type('#email', 'Ada!')
            await human.type('#notes', 'café 👋')
            await human.type('#prefilled', ' too')
            const values = await page.evaluate(
                (ids) => ids.map((id) => (document.getElementById(id) as HTMLInputElement).value),
                ['email', 'notes', 'prefilled']
            )
            expect(values).toEqual(['Ada!', 'café 👋', 'old value too'])
            const keys = (await events(page)).filter((e) => e.type === 'keydown').map((e) => e.key)
            expect(keys.slice(0, 6)).toEqual(['Shift', 'A', 'd', 'a', 'Shift', '!'])
        }))

    it('adds to the end of email and number fields, which keep their caret to themselves', () =>
        onFixture(async (page) => {
            const human = createHuman(page, fast)
            await human.type('#prefilled-email', '.org')
            await human.type('#prefilled-number', '34')
            const values = await page.evaluate(
                (ids) => ids.map((id) => (document.getElementById(id) as HTMLInputElement).value),
                ['prefilled-email', 'prefilled-number']
            )
            expect(values).toEqual(['ada.lovelace@example.org', '12345678901234'])
            const keys = (await events(page)).filter((e) => e.type === 'keydown').map((e) => e.key)
            expect(keys).toEqual(['ArrowRight', '.', 'o', 'r', 'g', 'ArrowRight', '3', '4'])

            // An empty one has nowhere to move to, so nothing extra is pressed.
            await page.evaluate(() => {
                ;(document.getElementById('prefilled-email') as HTMLInputElement).value = ''
            })
            await human.type('#prefilled-email', 'a')
            const after = (await events(page)).filter((e) => e.type === 'keydown').map((e) => e.key)
            expect(after.slice(keys.length)).toEqual(['a'])
        }))

    it('fixes its typos with Backspace', () =>
        onFixture(async (page) => {
            const human = createHuman(page, { ...fast, typing: { typos: 0.3 } })
            await human.type('#email', 'hello there')
            const value = await page.evaluate(
                () => (document.getElementById('email') as HTMLInputElement).value
            )
            expect(value).toBe('hello there')
            const keys = (await events(page)).filter((e) => e.type === 'keydown').map((e) => e.key)
            expect(keys).toContain('Backspace')
        }))

    it('presses keys and combinations, and editing shortcuts edit', () =>
        onFixture(async (page) => {
            const human = createHuman(page, fast)
            await human.click('#prefilled')
            await human.press('Enter')
            await human.press('ControlOrMeta+A')
            const keys = (await events(page)).filter((e) => e.type === 'keydown').map((e) => e.key)
            expect(keys).toEqual(['Enter', process.platform === 'darwin' ? 'Meta' : 'Control', 'A'])
            // On a Mac, Puppeteer selects only when sent the editing command with the key.
            const selected = await page.evaluate(() => {
                const el = document.activeElement as HTMLInputElement
                return [el.selectionStart, el.selectionEnd]
            })
            expect(selected).toEqual([0, 'old value'.length])
        }))

    it('scrolls with the wheel to reach a target, and to the bottom', () =>
        onFixture(async (page) => {
            const human = createHuman(page, fast)
            await human.click('#far')
            const log = await events(page)
            expect(log.filter((e) => e.type === 'wheel').length).toBeGreaterThan(2)
            expect(log.find((e) => e.type === 'click')?.target).toBe('far')
            await human.scroll({ to: 'bottom' })
            const { y, max } = await page.evaluate(() => ({
                y: scrollY,
                max: document.documentElement.scrollHeight - innerHeight,
            }))
            expect(y).toBe(max)
        }))

    it('wheels a scrolling panel to a target hidden inside it, with the mouse over the panel', () =>
        onFixture(async (page) => {
            await page.evaluate(() => {
                document.body.insertAdjacentHTML(
                    'beforeend',
                    `<div id="panel" style="position:fixed;left:900px;top:100px;width:300px;height:200px;overflow:auto;background:white;z-index:100">
                      <div style="height:1000px"><button id="deep" style="margin-top:600px">Deep</button></div>
                    </div>`
                )
            })
            const human = createHuman(page, fast)
            await human.click('#deep')
            const log = await events(page)
            const wheels = log.filter((e) => e.type === 'wheel')
            expect(wheels.length).toBeGreaterThan(0)
            expect(wheels.every((e) => e.x >= 900 && e.y >= 100 && e.y < 300)).toBe(true)
            expect(log.find((e) => e.type === 'click')?.target).toBe('deep')
        }))

    it('takes element handles and waits for late elements', () =>
        onFixture(async (page) => {
            const human = createHuman(page, fast)
            await human.click((await page.$('#signup')) as { boundingBox(): Promise<unknown> })
            await human.click('#late')
            const clicks = (await events(page)).filter((e) => e.type === 'click')
            expect(clicks.map((e) => e.target)).toEqual(['signup', 'late'])
        }))

    it('says what went wrong with a target', () =>
        onFixture(async (page) => {
            const human = createHuman(page, { ...fast, timeout: 300 })
            expect((await failure(human.click('#nope'))).code).toBe('TARGET_NOT_FOUND')
            expect((await failure(human.click('#hidden'))).code).toBe('TARGET_NOT_VISIBLE')
            const covered = await failure(human.click('#covered'))
            expect(covered.code).toBe('TARGET_COVERED')
            expect(covered.message).toContain('cookie-banner')
        }))

    it('replays a seed exactly', async () => {
        const trace = async () => {
            let moves: number[][] = []
            await onFixture(async (page) => {
                await createHuman(page, { ...fast, seed: 42 }).click('#signup')
                moves = (await events(page))
                    .filter((e) => e.type === 'mousemove')
                    .map((e) => [e.x, e.y])
            })
            return moves
        }
        expect(await trace()).toEqual(await trace())
    })

    it('draws the visible cursor', () =>
        onFixture(async (page) => {
            await createHuman(page, { ...fast, plugins: [visibleCursor()] }).move({
                x: 300,
                y: 200,
            })
            const state = await page.evaluate(() =>
                (window as any)[Symbol.for('definitely-not-a-robot.overlay')]?.state()
            )
            expect(state).toMatchObject({ x: 300, y: 200, visible: true })
        }))

    it.runIf(name === 'puppeteer')("takes Puppeteer's own selectors", () =>
        onFixture(async (page) => {
            await createHuman(page, fast).click('::-p-text(Sign up)')
            expect((await events(page)).find((e) => e.type === 'click')?.target).toBe('signup')
        })
    )
})
