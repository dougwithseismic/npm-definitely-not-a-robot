import type { Page } from 'playwright'
import { describe, expect, it } from 'vitest'
import { createHuman, playwrightDriver, presets, trail, visibleCursor } from '../../src'
import { boxCenter } from '../../src/geometry'
import { CSS_COLOR_NAMES } from '../../src/plugins/css-color'
import type { OverlayState } from '../../src/plugins/overlay-page'
import { events, failure, fast, useFixture } from './fixture'

const fx = useFixture()

const overlay = (page: Page): Promise<OverlayState | undefined> =>
    page.evaluate(() => (window as any)[Symbol.for('definitely-not-a-robot.overlay')]?.state())

/** The page, counting the init scripts added to it. */
function countInitScripts(page: Page): { page: Page; added: number } {
    const counted = { page, added: 0 }
    counted.page = new Proxy(page, {
        get: (target, key) =>
            key === 'addInitScript'
                ? (script: { content: string }) => {
                      counted.added++
                      return target.addInitScript(script)
                  }
                : Reflect.get(target, key, target),
    })
    return counted
}

/** Whether something is drawn at `p`: the pixels there change when the mouse moves away. */
async function drawnAt(page: Page, p: { x: number; y: number }): Promise<boolean> {
    const clip = { x: p.x - 2, y: p.y - 2, width: 22, height: 26 }
    await page.mouse.move(p.x, p.y)
    const here = await page.screenshot({ clip })
    await page.mouse.move(5, 5)
    const away = await page.screenshot({ clip })
    return !here.equals(away)
}

describe('visibleCursor', () => {
    it('knows the same colour names as the browser', async () => {
        const unknown = await fx.page.evaluate(
            (names) => names.filter((name) => !CSS.supports('color', name)),
            [...CSS_COLOR_NAMES]
        )
        expect(unknown).toEqual([])
    })

    it('draws a cursor where the mouse is, without getting in the way of clicks', async () => {
        const human = createHuman(fx.page, { ...fast, plugins: [visibleCursor()] })
        const point = await human.click('#signup')
        expect(await overlay(fx.page)).toMatchObject({ ...point, visible: true, pressed: false })
        expect((await events(fx.page)).find((e) => e.type === 'click')?.target).toBe('signup')
        const under = await fx.page.evaluate(
            ({ x, y }) => document.elementFromPoint(x, y)?.id,
            point
        )
        expect(under).toBe('signup')
    })

    it('shows up in screenshots, whatever the page’s CSS says', async () => {
        await fx.page.addStyleTag({
            content: `body ~ *, div, svg, path, [popover] {
                display: none !important; opacity: 0 !important; fill: transparent !important }`,
        })
        const human = createHuman(fx.page, { ...fast, plugins: [visibleCursor()] })
        await human.move({ x: 400, y: 200 })
        expect(await drawnAt(fx.page, { x: 400, y: 200 })).toBe(true)
    })

    it('draws a ring on every press that a video frame catches', async () => {
        const human = createHuman(fx.page, { ...fast, plugins: [visibleCursor()] })
        await human.move({ x: 400, y: 200 })
        // Above and left of the tip, where the ring shows and the arrow doesn't.
        const clip = { x: 380, y: 180, width: 16, height: 16 }
        const before = await fx.page.screenshot({ clip })
        // Slow every animation down, so a slow screenshot can't miss the ring's 550 ms.
        const cdp = await fx.page.context().newCDPSession(fx.page)
        await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 })
        await fx.page.mouse.down()
        await fx.page.waitForTimeout(1000) // 100 ms of animation: the ring is part-way out
        const during = await fx.page.screenshot({ clip })
        await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 })
        expect(during.equals(before)).toBe(false)
        expect(await overlay(fx.page)).toMatchObject({ pressed: true, ripples: 1 })
        await fx.page.mouse.up()
        expect(await overlay(fx.page)).toMatchObject({ pressed: false })
    })

    it('follows Playwright’s own clicks too', async () => {
        const human = createHuman(fx.page, { ...fast, plugins: [visibleCursor()] })
        await human.move({ x: 20, y: 20 })
        await fx.page.click('#signup')
        const box = (await fx.page.locator('#signup').boundingBox())!
        expect(await overlay(fx.page)).toMatchObject(boxCenter(box))
    })

    it('keeps going over iframes, without flooding the page’s message handlers', async () => {
        await fx.page.setContent(`<body style="margin:0">
            <script>addEventListener('message', () => { window.heard = (window.heard ?? 0) + 1 })</script>
            <iframe style="position:absolute;left:200px;top:100px;width:400px;height:300px;border:5px solid"
              srcdoc="<body style='margin:0'>Inside</body>"></iframe>
        </body>`)
        await fx.page.frameLocator('iframe').locator('body').waitFor()
        const human = createHuman(fx.page, { ...fast, plugins: [visibleCursor()] })
        await human.move({ x: 350, y: 260 })
        await expect.poll(() => overlay(fx.page)).toMatchObject({ x: 350, y: 260 })
        await human.move({ x: 450, y: 300 })
        await expect.poll(() => overlay(fx.page)).toMatchObject({ x: 450, y: 300 })
        // A handler added before the cursor hears its hello, but none of the moves.
        expect(await fx.page.evaluate(() => (window as any).heard)).toBe(1)
    })

    const near = (x: number, y: number) => ({ x: expect.closeTo(x, 0), y: expect.closeTo(y, 0) })

    it('keeps going over an iframe inside a shadow root', async () => {
        await fx.page.setContent(`<body style="margin:0"><div id="host"></div>
            <script>
              host.attachShadow({ mode: 'open' }).innerHTML =
                '<iframe style="position:absolute;left:200px;top:100px;width:400px;height:300px;border:0" ' +
                'srcdoc="<body style=margin:0>Inside</body>"></iframe>'
            </script>
        </body>`)
        await fx.page.frameLocator('iframe').locator('body').waitFor()
        const human = createHuman(fx.page, { ...fast, plugins: [visibleCursor()] })
        await human.move({ x: 350, y: 260 })
        await expect.poll(() => overlay(fx.page)).toMatchObject(near(350, 260))
    })

    it('stays under the mouse over an iframe scaled with CSS', async () => {
        await fx.page.setContent(`<body style="margin:0">
            <iframe style="position:absolute;left:200px;top:100px;width:400px;height:300px;border:4px solid;transform:scale(.5);transform-origin:0 0"
              srcdoc="<body style='margin:0'>Inside</body>"></iframe>
        </body>`)
        await fx.page.frameLocator('iframe').locator('body').waitFor()
        const human = createHuman(fx.page, { ...fast, plugins: [visibleCursor()] })
        await human.move({ x: 300, y: 200 })
        await expect.poll(() => overlay(fx.page)).toMatchObject(near(300, 200))
    })

    it('adds its script to a page once, however many humans draw on it', async () => {
        const counted = countInitScripts(fx.page)
        for (let i = 0; i < 3; i++) {
            const human = createHuman(counted.page, { ...fast, plugins: [visibleCursor()] })
            await human.move({ x: 50, y: 50 })
        }
        expect(counted.added).toBe(1)
    })

    it('stays on top of a modal dialog', async () => {
        await fx.page.setContent(`<body style="margin:0">
            <dialog id="d" style="width:400px;height:300px;border:0;background:#fff">Modal</dialog>
        </body>`)
        const human = createHuman(fx.page, { ...fast, plugins: [visibleCursor()] })
        await human.move({ x: 10, y: 10 })
        await fx.page.evaluate(() =>
            (document.querySelector('#d') as HTMLDialogElement).showModal()
        )
        expect(await drawnAt(fx.page, { x: 640, y: 420 })).toBe(true)
    })

    it('carries on across navigation and setContent, under a strict CSP', async () => {
        const page = (body: string) => ({
            status: 200,
            headers: {
                'content-type': 'text/html',
                'content-security-policy': "default-src 'none'",
            },
            body: `<!doctype html><body style="margin:0">${body}</body>`,
        })
        await fx.page.route('https://dnar.test/a', (route) =>
            route.fulfill(
                page('<a id="next" href="/b" style="margin:200px;display:block">Next</a>')
            )
        )
        await fx.page.route('https://dnar.test/b', (route) => route.fulfill(page('Page B')))
        await fx.page.goto('https://dnar.test/a')
        const human = createHuman(fx.page, { ...fast, plugins: [visibleCursor()] })
        const point = await human.click('#next')
        await fx.page.waitForURL('https://dnar.test/b')
        // Shown where the last page left off, before the mouse moves again.
        expect(await overlay(fx.page)).toMatchObject({ ...point, visible: true })
        expect(await drawnAt(fx.page, { x: 300, y: 300 })).toBe(true)

        await fx.page.setContent('<p>Replaced</p>')
        await human.move({ x: 500, y: 400 })
        expect(await overlay(fx.page)).toMatchObject({ x: 500, y: 400, visible: true })
    })

    it('is on in the demo preset', async () => {
        const human = createHuman(fx.page, { preset: 'demo', speed: 'instant' })
        await human.move({ x: 300, y: 300 })
        expect(await overlay(fx.page)).toMatchObject({ x: 300, y: 300, visible: true })
    })

    it('lets your own visibleCursor() restyle the demo preset’s', async () => {
        const counted = countInitScripts(fx.page)
        const human = createHuman(counted.page, {
            preset: 'demo',
            speed: 'instant',
            plugins: [visibleCursor({ color: '#dc2626' })],
        })
        await human.move({ x: 300, y: 300 })
        expect(counted.added).toBe(1)
        expect(presets.demo.plugins).toHaveLength(1)
    })

    it('rejects options that make no sense, and drivers that can’t draw', async () => {
        expect(() => visibleCursor({ size: 0 })).toThrow(/size/)
        expect(() => visibleCursor({ color: '' })).toThrow(/color/)
        expect(() => trail({ fade: -1 })).toThrow(/fade/)
        const driver = { ...playwrightDriver(fx.page), addScript: undefined }
        const human = createHuman(fx.page, { ...fast, driver, plugins: [visibleCursor()] })
        const error = await failure(human.move({ x: 10, y: 10 }))
        expect(error.code).toBe('UNSUPPORTED_PAGE')
        expect(error.message).toContain('visibleCursor()')
    })
})

describe('trail', () => {
    it('draws the path and lets it fade', async () => {
        const human = createHuman(fx.page, { ...fast, plugins: [trail({ fade: 300 })] })
        await human.move({ x: 100, y: 100 })
        await human.move({ x: 900, y: 500 })
        expect((await overlay(fx.page))?.trail).toBeGreaterThan(5)
        await expect.poll(async () => (await overlay(fx.page))?.trail).toBe(0)
    })
})
