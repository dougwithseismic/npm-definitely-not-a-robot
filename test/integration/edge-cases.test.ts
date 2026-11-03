import { describe, expect, it } from 'vitest'
import { createHuman, definePlugin, type HumanOptions } from '../../src'
import { events, FIXTURE_HTML, failure, moveTrace, useFixture } from './fixture'

// Regressions from reviewing the core: frames, scrolling panels, error mapping, seeds, plugins.

const fx = useFixture()

const fast = { speed: 'instant' as const, seed: 1 }

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
