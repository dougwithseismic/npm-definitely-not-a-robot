import type { Page } from 'playwright'
import { describe, expect, it } from 'vitest'
import {
    createHuman,
    defineDriver,
    definePlugin,
    type HumanOptions,
    playwrightDriver,
} from '../../src'
import { events, FIXTURE_HTML, failure, fast, moveTrace, useFixture } from './fixture'

// Regressions from reviewing the core: frames, scrolling panels, error mapping, seeds, plugins.

const fx = useFixture()

/** The built-in driver, counting the instant scrolls the library falls back to. */
function countInstantScrolls(page: Page) {
    const base = playwrightDriver(page)
    const scrolls = { instant: 0 }
    const driver = defineDriver({
        ...base,
        locate(target) {
            const ref = base.locate(target)
            if (!ref) return ref
            return {
                ...ref,
                scrollIntoView: () => {
                    scrolls.instant++
                    return ref.scrollIntoView()
                },
            }
        },
    })
    return { driver, scrolls }
}

describe('targets that scroll inside something else', () => {
    it('clicks a button scrolled out of sight inside an iframe, not the page behind it', async () => {
        await fx.page.setContent(`<body style="margin:0">
            <button id="behind" style="position:absolute;left:0;top:0;width:400px;height:800px">Behind</button>
            <iframe style="position:absolute;left:0;top:0;width:300px;height:300px;border:0" srcdoc="
              <body style='margin:0;height:1200px'>
                <button id='inner' style='position:absolute;left:10px;top:500px;width:120px;height:30px'
                  onclick='window.parent.innerClicked = true'>Inner</button>
              </body>"></iframe>
            <script>behind.onclick = () => { window.behindClicked = true }</script>
        </body>`)
        await fx.page.frameLocator('iframe').locator('#inner').waitFor()
        const human = createHuman(fx.page, fast)
        await human.click(fx.page.frameLocator('iframe').locator('#inner'))
        expect(await fx.page.evaluate(() => (window as any).innerClicked)).toBe(true)
        expect(await fx.page.evaluate(() => (window as any).behindClicked)).toBeUndefined()
    })

    it('clicks a button scrolled out of sight inside a panel instead of blaming the footer', async () => {
        await fx.page.setContent(`<body style="margin:0">
            <div id="panel" style="position:absolute;left:0;top:0;width:300px;height:200px;overflow:auto">
              <div style="height:1000px"><button id="deep" style="margin-top:600px">Deep</button></div>
            </div>
            <footer id="foot" style="position:absolute;left:0;top:200px;width:300px;height:600px">Footer</footer>
            <script>deep.onclick = () => { window.deepClicked = true }</script>
        </body>`)
        const human = createHuman(fx.page, fast)
        await human.click('#deep')
        expect(await fx.page.evaluate(() => (window as any).deepClicked)).toBe(true)
    })

    it('moves over a panel and wheels it to a target hidden inside', async () => {
        await fx.page.setContent(`<body style="margin:0">
            <div id="panel" style="position:absolute;left:100px;top:100px;width:300px;height:200px;overflow:auto">
              <div style="height:1000px"><button id="deep" style="margin-top:600px">Deep</button></div>
            </div>
            <script>
              window.wheels = []
              panel.addEventListener('wheel', (e) => wheels.push([e.clientX, e.clientY]), { passive: true })
              deep.onclick = () => { window.deepClicked = true }
            </script>
        </body>`)
        const counted = countInstantScrolls(fx.page)
        const moves: { x: number; y: number }[] = []
        const driver = defineDriver({
            ...counted.driver,
            moveMouse: (x, y) => {
                moves.push({ x, y })
                return counted.driver.moveMouse(x, y)
            },
        })
        const human = createHuman(fx.page, { ...fast, driver, startPosition: { x: 900, y: 600 } })
        await human.click('#deep')
        const { clicked, wheels } = await fx.page.evaluate(() => ({
            clicked: (window as any).deepClicked,
            wheels: (window as any).wheels as number[][],
        }))
        expect(clicked).toBe(true)
        expect(wheels.length).toBeGreaterThan(0)
        expect(counted.scrolls.instant).toBe(0)
        // Once over the panel, the mouse stays there: it doesn't jump back to where it started.
        const first = moves.findIndex(({ x, y }) => x >= 100 && x < 400 && y >= 100 && y < 300)
        expect(first).toBeGreaterThan(-1)
        const near = moves
            .slice(first)
            .every(({ x, y }) => x >= 50 && x < 450 && y >= 50 && y < 350)
        expect(near).toBe(true)
    })

    it('wheels an iframe to a target scrolled out of sight inside it', async () => {
        await fx.page.setContent(`<body style="margin:0">
            <iframe style="position:absolute;left:200px;top:100px;width:300px;height:300px;border:0" srcdoc="
              <body style='margin:0;height:1200px'>
                <button id='inner' style='position:absolute;left:10px;top:500px;width:120px;height:30px'
                  onclick='window.parent.innerClicked = true'>Inner</button>
                <script>addEventListener('wheel', () => { parent.frameWheels = (parent.frameWheels || 0) + 1 }, { passive: true })</script>
              </body>"></iframe>
        </body>`)
        const inner = fx.page.frameLocator('iframe').locator('#inner')
        await inner.waitFor()
        const { driver, scrolls } = countInstantScrolls(fx.page)
        const human = createHuman(fx.page, { ...fast, driver, startPosition: { x: 900, y: 600 } })
        await human.click(inner)
        expect(await fx.page.evaluate(() => (window as any).innerClicked)).toBe(true)
        expect(await fx.page.evaluate(() => (window as any).frameWheels)).toBeGreaterThan(0)
        expect(scrolls.instant).toBe(0)
    })

    it('wheels an app’s main panel to a target below the fold, from over the nav', async () => {
        await fx.page.setContent(`<body style="margin:0;height:100vh;overflow:hidden;display:flex">
            <nav style="width:200px">Nav</nav>
            <main id="main" style="flex:1;overflow:auto">
              <div style="height:3000px;padding-top:2400px"><button id="end">End</button></div>
            </main>
            <script>
              window.wheels = 0
              main.addEventListener('wheel', () => { wheels++ }, { passive: true })
              end.onclick = () => { window.endClicked = true }
            </script>
        </body>`)
        const { driver, scrolls } = countInstantScrolls(fx.page)
        const human = createHuman(fx.page, { ...fast, driver, startPosition: { x: 100, y: 400 } })
        await human.click('#end')
        expect(await fx.page.evaluate(() => (window as any).endClicked)).toBe(true)
        expect(await fx.page.evaluate(() => (window as any).wheels)).toBeGreaterThan(0)
        expect(scrolls.instant).toBe(0)
    })

    it('still reaches a target in a panel the wheel can’t scroll', async () => {
        await fx.page.setContent(`<body style="margin:0">
            <div style="position:absolute;left:100px;top:100px;width:300px;height:200px;overflow:hidden">
              <div style="height:1000px"><button id="deep" style="margin-top:600px">Deep</button></div>
            </div>
            <script>deep.onclick = () => { window.deepClicked = true }</script>
        </body>`)
        const { driver, scrolls } = countInstantScrolls(fx.page)
        const human = createHuman(fx.page, { ...fast, driver })
        await human.click('#deep')
        expect(await fx.page.evaluate(() => (window as any).deepClicked)).toBe(true)
        expect(scrolls.instant).toBeGreaterThan(0)
    })

    // A card with rounded corners hides its overflow but doesn't scroll: the page does, so the
    // target lands mid-screen, clear of fixed bars, not at the edge where the card peeks in.
    it.each([
        {
            name: 'a sticky header, with the card mostly scrolled past',
            bar: 'top:0;height:70px',
            card: 'top:1000px;height:600px',
            button: 'margin-top:100px',
            scrollY: 1560,
        },
        {
            name: 'a bottom bar, with the card starting at the fold',
            bar: 'bottom:0;height:120px',
            card: 'top:700px;height:1500px',
            button: 'margin-top:300px',
            scrollY: 0,
        },
    ])('clicks a button in a card that hides its overflow, past $name', async (c) => {
        await fx.page.setContent(`<body style="margin:0;height:4000px">
            <div style="position:fixed;left:0;right:0;${c.bar};background:#333;z-index:10"></div>
            <div style="position:absolute;left:100px;width:400px;${c.card};overflow:hidden;border-radius:8px">
              <button id="b" style="${c.button}">Edit</button>
            </div>
            <script>b.onclick = () => { window.clicked = true }</script>
        </body>`)
        await fx.page.evaluate((y) => window.scrollTo(0, y), c.scrollY)
        const human = createHuman(fx.page, { ...fast, startPosition: { x: 640, y: 400 } })
        await human.click('#b', { timeout: 3000 })
        expect(await fx.page.evaluate(() => (window as any).clicked)).toBe(true)
    })

    it.each(['clip', 'auto'])(
        'clicks into an opening accordion (overflow: %s)',
        async (overflow) => {
            await fx.page.setContent(`<body style="margin:0">
            <div id="acc" style="position:absolute;left:100px;top:100px;width:300px;height:0;overflow:${overflow};transition:height 1.2s linear">
              <button id="b" style="margin-top:300px">Item</button>
            </div>
            <script>
              b.onclick = () => { window.clicked = true }
              requestAnimationFrame(() => { acc.style.height = '400px' })
            </script>
        </body>`)
            const human = createHuman(fx.page, { ...fast, startPosition: { x: 640, y: 600 } })
            await human.click('#b', { timeout: 4000 })
            expect(await fx.page.evaluate(() => (window as any).clicked)).toBe(true)
        }
    )

    it('sends every move of a drag into a panel while the button is down, even instantly', async () => {
        await fx.page.setContent(`<body style="margin:0">
            <div id="src" style="position:absolute;left:100px;top:600px;width:60px;height:60px"></div>
            <div style="position:absolute;left:600px;top:100px;width:300px;height:200px;overflow:auto">
              <div style="height:1000px;padding-top:700px"><div id="dst" style="width:100px;height:60px"></div></div>
            </div>
            <script>
              window.seen = []
              for (const type of ['mousedown', 'mousemove', 'wheel', 'mouseup'])
                addEventListener(type, (e) => seen.push({ type, target: e.target.id }), { capture: true, passive: true })
            </script>
        </body>`)
        const human = createHuman(fx.page, { ...fast, startPosition: { x: 640, y: 600 } })
        await human.drag('#src', '#dst')
        const log: { type: string; target: string }[] = await fx.page.evaluate(
            () => (window as any).seen
        )
        const down = log.findIndex((e) => e.type === 'mousedown')
        const wheel = log.findIndex((e) => e.type === 'wheel')
        expect(wheel).toBeGreaterThan(down)
        // On the way to the panel to wheel it, as well as on the way to the drop.
        const toPanel = log.slice(down, wheel).filter((e) => e.type === 'mousemove')
        expect(toPanel.length).toBeGreaterThan(8)
        expect(log.find((e) => e.type === 'mouseup')?.target).toBe('dst')
    })

    it('wheels a target that only peeks in at the viewport edge', async () => {
        // A small target whose centre is inside the viewport but within the edge margin.
        await fx.page.evaluate(() => {
            const far = document.querySelector('#far') as HTMLElement
            far.style.height = '10px'
            window.scrollTo(0, far.offsetTop - window.innerHeight + 7)
        })
        const human = createHuman(fx.page, fast)
        await human.click('#far')
        const log = await events(fx.page)
        expect(log.filter((e) => e.type === 'wheel').length).toBeGreaterThan(0)
        expect(log.find((e) => e.type === 'click')?.target).toBe('far')
    })

    it('scrolls an app shell’s main panel to the bottom', async () => {
        await fx.page.setContent(`<body style="margin:0;height:100vh;overflow:hidden;display:flex">
            <nav style="width:200px">Nav</nav>
            <main id="main" style="flex:1;overflow:auto"><div style="height:5000px">Long</div></main>
        </body>`)
        const human = createHuman(fx.page, { ...fast, startPosition: { x: 700, y: 400 } })
        await human.scroll({ to: 'bottom' })
        const { top, max } = await fx.page.evaluate(() => {
            const main = document.querySelector('#main') as HTMLElement
            return { top: main.scrollTop, max: main.scrollHeight - main.clientHeight }
        })
        expect(top).toBeGreaterThan(max - 5)
    })
})

describe('errors say what actually went wrong', () => {
    it('names an ambiguous locator instead of calling it invisible', async () => {
        const human = createHuman(fx.page, { ...fast, timeout: 3000 })
        const started = Date.now()
        const error = await failure(human.click(fx.page.getByRole('button')))
        expect(error.code).toBe('TARGET_AMBIGUOUS')
        expect(error.message).toMatch(/matches \d+ elements/)
        expect(Date.now() - started).toBeLessThan(2000)
    })

    it('passes a broken selector’s own error through instead of "not found"', async () => {
        const human = createHuman(fx.page, fast)
        const error = await failure(human.click('button['))
        expect(error.code).toBeUndefined()
        expect(error.message).toMatch(/selector/i)
    })

    it('rejects a timeout of 0 rather than waiting forever', async () => {
        expect(() => createHuman(fx.page, { timeout: 0 })).toThrow(/timeout/)
        const human = createHuman(fx.page, fast)
        expect((await failure(human.click('#signup', { timeout: 0 }))).code).toBe('INVALID_OPTION')
    })

    it('rejects type() with a target and no text', async () => {
        const human = createHuman(fx.page, fast)
        const error = await failure((human.type as any)(fx.page.locator('#email')))
        expect(error.code).toBe('INVALID_OPTION')
        expect(error.message).toContain('needs text')
    })

    it('rejects strategy options that would hang', () => {
        expect(() => createHuman(fx.page, { motion: { interval: 0 } })).toThrow(/motion.interval/)
        expect(() => createHuman(fx.page, { scroll: { notch: 0 } })).toThrow(/scroll.notch/)
        expect(() => createHuman(fx.page, { typing: { typos: 2 } })).toThrow(/typing.typos/)
    })
})

describe('keys and text', () => {
    it('presses the plus key on its own', async () => {
        const human = createHuman(fx.page, fast)
        await human.click('#notes')
        await human.press('+')
        expect(await fx.page.inputValue('#notes')).toBe('+')
        expect((await failure(human.press('Control+'))).code).toBe('INVALID_OPTION')
    })

    it('types Windows line endings and tabs exactly', async () => {
        const human = createHuman(fx.page, fast)
        await human.type('#notes', 'a\r\nb\tc')
        expect(await fx.page.inputValue('#notes')).toBe('a\nb\tc')
    })

    it('adds to the end of a field that already has text', async () => {
        for (const seed of [1, 2, 3]) {
            await fx.page.fill('#prefilled', 'old value')
            const human = createHuman(fx.page, { speed: 'instant', seed })
            await human.type('#prefilled', '!')
            expect(await fx.page.inputValue('#prefilled')).toBe('old value!')
        }
    })
})

describe('seeds and plugins', () => {
    it('replays the same click point however long a cover takes to go away', async () => {
        const pressAt = async (delay: number) => {
            await fx.page.setContent(FIXTURE_HTML)
            await fx.page.evaluate((ms) => {
                setTimeout(() => document.querySelector('#overlay')?.remove(), ms)
            }, delay)
            const human = createHuman(fx.page, { speed: 'instant', seed: 99 })
            return human.click('#covered')
        }
        const first = await pressAt(150)
        const second = await pressAt(420)
        expect(second).toEqual(first)
    })

    it('merges nested options with the preset’s', async () => {
        const path = (options: HumanOptions) =>
            moveTrace(fx.browser, (p) => createHuman(p, options).move('#signup'))
        const merged = await path({
            ...fast,
            preset: 'careful',
            motion: { fitts: { b: 190 } },
        })
        const spelledOut = await path({
            ...fast,
            motion: { fitts: { a: 120, b: 190 }, curvature: 0.25 },
        })
        expect(merged).toEqual(spelledOut)
    })

    it('lets a plugin hook act without deadlocking, and retries a failed setup', async () => {
        let setups = 0
        const plugin = definePlugin({
            name: 'nudge',
            setup() {
                setups++
                if (setups === 1) throw new Error('flaky setup')
            },
            async beforeAction(action, { human }) {
                if (action.type === 'click') await human.move({ x: 20, y: 20 })
            },
        })
        const human = createHuman(fx.page, { ...fast, plugins: [plugin] })
        await expect(human.click('#signup')).rejects.toThrow('flaky setup')
        await human.click('#signup')
        const log = await events(fx.page)
        expect(setups).toBe(2)
        expect(log.some((e) => e.type === 'mousemove' && e.x === 20 && e.y === 20)).toBe(true)
        expect(log.find((e) => e.type === 'click')?.target).toBe('signup')
    })
})
