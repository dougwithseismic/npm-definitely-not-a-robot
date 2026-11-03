import { type Browser, chromium, type Page } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import type { HumanError } from '../../src'

/** A test page that records every input event it receives in `window.events`. */
export const FIXTURE_HTML = /* html */ `<!doctype html>
<html>
<head>
<style>
  body { margin: 0; font: 16px sans-serif; height: 3000px; }
  #signup { position: absolute; left: 700px; top: 120px; width: 140px; height: 44px; }
  #email { position: absolute; left: 100px; top: 300px; width: 260px; height: 32px; }
  #notes { position: absolute; left: 100px; top: 360px; width: 260px; height: 60px; }
  #prefilled { position: absolute; left: 400px; top: 300px; width: 200px; height: 32px; }
  /* Narrower than their text, so a click lands in the middle of it. */
  #prefilled-email { position: absolute; left: 400px; top: 360px; width: 120px; height: 32px; }
  #prefilled-number { position: absolute; left: 400px; top: 410px; width: 120px; height: 32px; }
  #far { position: absolute; left: 300px; top: 2200px; width: 160px; height: 40px; }
  #covered { position: absolute; left: 100px; top: 500px; width: 120px; height: 40px; }
  #overlay { position: absolute; left: 80px; top: 480px; width: 200px; height: 90px;
             background: rgba(0,0,0,.4); }
  #menu { position: absolute; left: 500px; top: 500px; width: 120px; height: 36px; background: #eee; }
  #menu .item { display: none; padding: 8px; background: #ddd; }
  #menu:hover .item { display: block; }
  #source { position: absolute; left: 100px; top: 650px; width: 60px; height: 60px; background: tomato; }
  #dropzone { position: absolute; left: 600px; top: 650px; width: 160px; height: 120px; background: #cde; }
  #hidden { display: none; }
  #late { position: absolute; left: 900px; top: 300px; width: 100px; height: 30px; }
</style>
</head>
<body>
  <button id="signup">Sign up</button>
  <input id="email" />
  <textarea id="notes"></textarea>
  <input id="prefilled" value="old value" />
  <input id="prefilled-email" type="email" value="ada.lovelace@example" />
  <input id="prefilled-number" type="number" value="123456789012" />
  <button id="far">Far away</button>
  <button id="covered">Covered</button>
  <div id="overlay" class="cookie-banner"></div>
  <div id="menu">Products <div class="item" id="menu-item">Pricing</div></div>
  <div id="source"></div>
  <div id="dropzone"></div>
  <button id="hidden">Hidden</button>
<script>
  window.events = []
  const log = (e) => window.events.push({
    type: e.type, x: e.clientX, y: e.clientY, key: e.key, target: e.target.id || e.target.tagName,
    detail: e.detail, button: e.button, deltaY: e.deltaY, shift: e.shiftKey, t: performance.now(),
  })
  for (const type of ['mousemove','mousedown','mouseup','click','dblclick','keydown','keyup','wheel','contextmenu'])
    window.addEventListener(type, log, { capture: true, passive: true })
  // A simple drag: press on #source, release over #dropzone.
  let dragging = false
  source.addEventListener('mousedown', () => { dragging = true })
  window.addEventListener('mouseup', (e) => {
    if (dragging && document.elementsFromPoint(e.clientX, e.clientY).includes(dropzone)) window.dropped = true
    dragging = false
  })
  setTimeout(() => {
    const late = document.createElement('button')
    late.id = 'late'; late.textContent = 'Late'
    document.body.appendChild(late)
  }, 400)
</script>
</body>
</html>`

export async function launch(): Promise<Browser> {
    return chromium.launch({ headless: true })
}

export const VIEWPORT = { width: 1280, height: 800 }

export async function openFixture(browser: Browser): Promise<Page> {
    const page = await browser.newPage({ viewport: VIEWPORT })
    await page.setContent(FIXTURE_HTML)
    return page
}

export interface RecordedEvent {
    type: string
    x: number
    y: number
    key?: string
    target: string
    detail: number
    button: number
    deltaY?: number
    shift?: boolean
    t: number
}

export const events = (page: Page): Promise<RecordedEvent[]> =>
    page.evaluate(() => (window as unknown as { events: RecordedEvent[] }).events)

/** One browser per test file and a fresh fixture page for every test. */
/** Options for tests that check results, not timing: no waits, same random draws every run. */
export const fast = { speed: 'instant' as const, seed: 1 }

export function useFixture(): { readonly browser: Browser; readonly page: Page } {
    const state = {} as { browser: Browser; page: Page }
    beforeAll(async () => {
        state.browser = await launch()
    })
    afterAll(async () => {
        await state.browser?.close()
    })
    beforeEach(async () => {
        state.page = await openFixture(state.browser)
    })
    afterEach(async () => {
        await state.page?.close()
    })
    return state
}

/** The error a promise rejects with. Fails the test if it resolves. */
export async function failure(promise: Promise<unknown>): Promise<HumanError> {
    try {
        await promise
    } catch (error) {
        return error as HumanError
    }
    throw new Error('expected the promise to reject')
}

/** The mouse positions the page saw while `act` ran on a fresh fixture page. */
export async function moveTrace(
    browser: Browser,
    act: (page: Page) => Promise<unknown>
): Promise<number[][]> {
    const page = await openFixture(browser)
    try {
        await act(page)
        return (await events(page)).filter((e) => e.type === 'mousemove').map((e) => [e.x, e.y])
    } finally {
        await page.close()
    }
}
