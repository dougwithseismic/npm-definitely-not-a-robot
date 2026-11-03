import type { Page } from 'playwright'
import { type Human, type HumanOptions, trail, wheelScroll } from '../../src'
import type { StageOptions } from './stage'

export interface Take {
    page: Page
    human: Human<Page>
    /** Show a line of code in the code bar. */
    code(text: string): Promise<void>
}

/** One recording: a page, options for `createHuman` (on top of the demo preset) and a script. */
export interface Side {
    stage: StageOptions
    options?: HumanOptions
    /** Drive this side through Puppeteer instead of Playwright (which still films it). */
    driver?: 'puppeteer'
    run(take: Take): Promise<void>
}

export interface Scene {
    /** File name in docs/media. */
    name: string
    viewport: { width: number; height: number }
    /** Where the cursor starts. */
    start: { x: number; y: number }
    /** One side, or two recorded separately and shown side by side. */
    sides: Side[]
}

const wide = { width: 1280, height: 720 }
const half = { width: 720, height: 540 }

// ---- the hero: Playwright's own input next to a person's ----

const signupCss = `
main { display: grid; place-items: center; height: calc(100vh - 116px); }
.card { width: 440px; padding: 32px; }
h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: -.02em; }
p { margin: 0 0 22px; color: var(--muted); }
label { display: block; font-size: 15px; font-weight: 600; margin: 14px 0 6px; }
.btn { width: 100%; margin-top: 22px; padding: 13px; font-size: 18px; }
.done { display: none; text-align: center; padding: 30px 0; font-size: 22px; font-weight: 650; }
.welcome .form { display: none; } .welcome .done { display: block; }
.done span { display: block; font-size: 48px; }`

const signupBody = `<main><div class="card" id="card">
  <div class="form"><h1>Create your account</h1><p>Start your free trial.</p>
  <label for="email">Email</label><input id="email" autocomplete="off">
  <label for="password">Password</label><input id="password" type="password">
  <button class="btn" id="signup">Sign up</button></div>
  <div class="done"><span>👋</span>Welcome, Ada</div>
</div></main>`

const signupScript = `document.getElementById('signup').addEventListener('click', () =>
    setTimeout(() => document.getElementById('card').classList.add('welcome'), 250))`

const signupStage = { body: signupBody, css: signupCss, script: signupScript }

/** Signs Ada up with the human, showing each line in the code bar. */
async function signUp({ human, code }: Take) {
    await code("await human.type('#email', 'ada@example.com')")
    await human.type('#email', 'ada@example.com')
    await code("await human.type('#password', 'hunter22')")
    await human.type('#password', 'hunter22')
    await code("await human.click('#signup')")
    await human.click('#signup')
}

/** Signs Ada up with plain Playwright calls, paced so viewers can read the code bar. */
async function fillSignUp({ page, code }: Take) {
    await page.waitForTimeout(500)
    await code("await page.fill('#email', 'ada@example.com')")
    await page.fill('#email', 'ada@example.com')
    await page.waitForTimeout(900)
    await code("await page.fill('#password', 'hunter22')")
    await page.fill('#password', 'hunter22')
    await page.waitForTimeout(900)
    await code("await page.click('#signup')")
    await page.click('#signup')
}

const hero: Scene = {
    name: 'hero',
    viewport: half,
    start: { x: 560, y: 470 },
    sides: [
        {
            stage: { label: 'Playwright on its own', plain: true, ...signupStage },
            run: fillSignUp,
        },
        {
            stage: { label: 'With definitely-not-a-robot', ...signupStage },
            options: { speed: 1.4 },
            run: signUp,
        },
    ],
}

// ---- the same human on Puppeteer ----

/** Says which tool made the page, then signs Ada up with the same calls. */
const signUpOn = (made: string) => async (take: Take) => {
    await take.code(`const human = createHuman(page) // ${made}`)
    await take.page.waitForTimeout(900)
    await signUp(take)
}

const puppeteerScene: Scene = {
    name: 'puppeteer',
    viewport: half,
    start: { x: 560, y: 470 },
    sides: [
        {
            stage: { label: 'Playwright', ...signupStage },
            options: { speed: 1.4 },
            run: signUpOn('page from Playwright'),
        },
        {
            stage: { label: 'Puppeteer', ...signupStage },
            options: { speed: 1.4 },
            driver: 'puppeteer',
            run: signUpOn('page from Puppeteer'),
        },
    ],
}

// ---- the Playwright Test fixture ----

const fixture: Scene = {
    name: 'playwright-test',
    viewport: wide,
    start: { x: 900, y: 620 },
    sides: [
        {
            stage: { label: 'In Playwright Test', ...signupStage },
            options: { speed: 1.4 },
            async run(take) {
                await take.code("import { test } from 'definitely-not-a-robot/playwright'")
                await take.page.waitForTimeout(1200)
                await take.code("test('sign up', async ({ page, human }) => {")
                await take.page.waitForTimeout(900)
                await signUp(take)
            },
        },
    ],
}

// ---- numbered dots to click, for curved paths and seeds ----

/** Round numbered buttons centred on each target, `size` pixels across. */
const dotStage = (targets: { id: string; x: number; y: number }[], size: number) => ({
    css: `.dot { position: absolute; width: ${size}px; height: ${size}px; border-radius: 50%;
        border: 0; background: var(--accent); color: #fff; font-weight: 700;
        font-size: ${Math.round(size * 0.32)}px; transition: background .2s, transform .2s; }
        .dot.hit { background: var(--good); transform: scale(.92); }`,
    body: targets
        .map(
            (d, i) =>
                `<button class="dot" id="${d.id}" style="left:${d.x - size / 2}px;top:${d.y - size / 2}px">${i + 1}</button>`
        )
        .join(''),
})

// ---- curved paths ----

const dots = [
    { id: 't1', x: 980, y: 160 },
    { id: 't2', x: 260, y: 220 },
    { id: 't3', x: 1080, y: 520 },
    { id: 't4', x: 520, y: 440 },
]

const curve: Scene = {
    name: 'curved-paths',
    viewport: wide,
    start: { x: 140, y: 560 },
    sides: [
        {
            stage: {
                label: 'Clicking',
                ...dotStage(dots, 64),
                script: `document.querySelectorAll('.dot').forEach((d) =>
                    d.addEventListener('click', () => d.classList.add('hit')))`,
            },
            options: { seed: 11, motion: { overshoot: 0.6 }, plugins: [trail({ fade: 2200 })] },
            async run({ human, code }) {
                for (const d of dots) {
                    await code(`await human.click('#${d.id}')`)
                    await human.click(`#${d.id}`)
                }
            },
        },
    ],
}

// ---- hover menus ----

const hover: Scene = {
    name: 'hover-menu',
    viewport: wide,
    start: { x: 900, y: 560 },
    sides: [
        {
            stage: {
                label: 'Hovering',
                css: `nav { display: flex; gap: 8px; padding: 18px 32px; background: #fff;
                    border-bottom: 1px solid var(--line); }
                .item { position: relative; padding: 10px 16px; border-radius: 10px; font-weight: 600; }
                .item:hover { background: #eef2ff; color: var(--accent); }
                .menu { display: none; position: absolute; top: 46px; left: 0; width: 260px;
                    padding: 8px; background: #fff; border: 1px solid var(--line);
                    border-radius: 12px; box-shadow: 0 12px 32px rgba(15,23,42,.12); }
                .item:hover .menu { display: block; }
                .menu a { display: block; padding: 10px 12px; border-radius: 8px; color: var(--ink);
                    text-decoration: none; font-weight: 500; }
                .menu a:hover { background: var(--bg); }
                .menu small { display: block; color: var(--muted); font-size: 13px; }
                .toast { position: fixed; left: 50%; top: 320px; transform: translateX(-50%);
                    padding: 14px 22px; border-radius: 12px; background: var(--ink); color: #fff;
                    opacity: 0; transition: opacity .3s; }
                .toast.on { opacity: 1; }`,
                body: `<nav>
                  <div class="item" id="products">Products ▾
                    <div class="menu">
                      <a href="#" id="automation">Automation<small>Scripts that click for you</small></a>
                      <a href="#" id="recording">Recording<small>Demo videos from tests</small></a>
                      <a href="#" id="testing">Testing<small>E2E that behaves like users</small></a>
                    </div></div>
                  <div class="item">Pricing</div><div class="item">Docs</div></nav>
                  <div class="toast" id="toast">Opened Recording</div>`,
                script: `document.getElementById('recording').addEventListener('click', (e) => {
                    e.preventDefault(); document.getElementById('toast').classList.add('on') })`,
            },
            options: { seed: 4 },
            async run({ human, code }) {
                await code("await human.hover('#products')")
                await human.hover('#products')
                await code("await human.click('#recording')")
                await human.click('#recording')
            },
        },
    ],
}

// ---- drag and drop ----

const card = (id: string, text: string, tag: string) =>
    `<div class="task" id="${id}"><b>${tag}</b>${text}</div>`

const drag: Scene = {
    name: 'drag-and-drop',
    viewport: wide,
    start: { x: 640, y: 600 },
    sides: [
        {
            stage: {
                label: 'Dragging',
                css: `main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
                    padding: 32px; }
                .col { background: #f1f5f9; border-radius: 14px; padding: 14px; min-height: 420px; }
                .col h2 { margin: 4px 6px 14px; font-size: 15px; color: var(--muted);
                    text-transform: uppercase; letter-spacing: .06em; }
                .task { background: #fff; border: 1px solid var(--line); border-radius: 12px;
                    padding: 14px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(15,23,42,.05);
                    user-select: none; }
                .task b { display: inline-block; font-size: 12px; padding: 2px 8px; margin-right: 8px;
                    border-radius: 99px; background: #eef2ff; color: var(--accent); }
                .ghost { position: fixed; pointer-events: none; transform: rotate(3deg);
                    box-shadow: 0 16px 32px rgba(15,23,42,.18); z-index: 4; }
                .col.over { outline: 2px dashed var(--accent); outline-offset: -4px; }`,
                body: `<main>
                  <section class="col" id="todo"><h2>To do</h2>
                    ${card('c1', 'Record the onboarding demo', 'video')}
                    ${card('c2', 'Fix flaky checkout test', 'e2e')}</section>
                  <section class="col" id="doing"><h2>Doing</h2>
                    ${card('c3', 'Write the launch post', 'docs')}</section>
                  <section class="col" id="done"><h2>Done</h2></section></main>`,
                script: `let dragged = null, ghost = null, dx = 0, dy = 0
                const colAt = (x, y) => document.elementsFromPoint(x, y).find((el) => el.classList.contains('col'))
                addEventListener('pointerdown', (e) => {
                    dragged = e.target.closest('.task'); if (!dragged) return
                    const r = dragged.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top
                    ghost = dragged.cloneNode(true); ghost.classList.add('ghost'); ghost.style.width = r.width + 'px'
                    document.body.append(ghost); dragged.style.opacity = '.35'; move(e) })
                const move = (e) => { if (!ghost) return
                    ghost.style.left = e.clientX - dx + 'px'; ghost.style.top = e.clientY - dy + 'px'
                    const over = colAt(e.clientX, e.clientY); document.querySelectorAll('.col').forEach((c) => c.classList.toggle('over', c === over)) }
                addEventListener('pointermove', move)
                addEventListener('pointerup', (e) => { if (!dragged) return
                    const col = colAt(e.clientX, e.clientY); if (col) col.append(dragged)
                    dragged.style.opacity = ''; ghost.remove(); ghost = dragged = null
                    document.querySelectorAll('.col').forEach((c) => c.classList.remove('over')) })`,
            },
            options: { seed: 3 },
            async run({ human, code }) {
                await code("await human.drag('#c2', '#done')")
                await human.drag('#c2', '#done')
            },
        },
    ],
}

// ---- typing ----

const typing: Scene = {
    name: 'typing',
    viewport: wide,
    start: { x: 980, y: 560 },
    sides: [
        {
            stage: {
                label: 'Typing',
                keys: true,
                css: `main { display: grid; place-items: center; height: calc(100vh - 116px); }
                .card { width: 820px; padding: 30px 34px; font-size: 20px; }
                .row { display: flex; gap: 14px; align-items: center; padding: 10px 0;
                    border-bottom: 1px solid var(--line); color: var(--muted); }
                .row b { color: var(--ink); font-weight: 600; }
                textarea { margin-top: 18px; height: 150px; resize: none; font-size: 28px; }`,
                body: `<main><div class="card">
                  <div class="row">To <b>Ada Lovelace</b></div>
                  <div class="row">Subject <b>Q3 numbers</b></div>
                  <textarea id="message" placeholder="Write a reply…"></textarea>
                </div></main>`,
            },
            options: { seed: 7, speed: 1.25, typing: { typos: 0.06 } },
            async run({ human, code }) {
                await code("await human.type('#message', 'Hi Ada! Q3 looks great. Ship it?')")
                await human.type('#message', 'Hi Ada! Q3 looks great. Ship it?')
            },
        },
    ],
}

// ---- scrolling into view ----

const articleStage = {
    label: 'Scrolling',
    keys: true,
    css: `article { max-width: 760px; margin: 0 auto; padding: 40px 24px 200px; }
        h1 { font-size: 40px; letter-spacing: -.03em; margin: 0 0 12px; }
        .lead { font-size: 21px; color: var(--muted); }
        .block { height: 150px; margin: 26px 0; border-radius: 14px;
            background: linear-gradient(135deg, #eef2ff, #f1f5f9); }
        .line { height: 14px; margin: 12px 0; border-radius: 7px; background: #e2e8f0; }
        .cta { text-align: center; padding: 40px; margin-top: 40px; }
        .cta .btn { font-size: 19px; padding: 15px 30px; }`,
    body: `<article><h1>Ship demos that look human</h1>
          <p class="lead">Record product videos straight from your Playwright tests.</p>
          ${'<div class="block"></div><div class="line"></div><div class="line" style="width:80%"></div><div class="line" style="width:60%"></div>'.repeat(6)}
          <div class="card cta"><h2>Ready?</h2><button class="btn" id="trial">Start free trial</button></div>
        </article>`,
}

const scroll: Scene = {
    name: 'scroll-into-view',
    viewport: wide,
    start: { x: 640, y: 420 },
    sides: [
        {
            stage: articleStage,
            options: { seed: 5 },
            async run({ page, human, code }) {
                await page.waitForTimeout(900)
                await code("await human.click('#trial')  // scrolls there first")
                await human.click('#trial')
            },
        },
    ],
}

// ---- a mouse wheel next to a trackpad ----

const scrollDown = async ({ page, human, code }: Take) => {
    await page.waitForTimeout(700)
    await code('await human.scroll({ by: 1400 })')
    await human.scroll({ by: 1400 })
    await page.waitForTimeout(900)
}

const trackpad: Scene = {
    name: 'trackpad-scroll',
    viewport: half,
    start: { x: 360, y: 300 },
    sides: [
        {
            stage: { ...articleStage, label: 'scroll: wheelScroll()', plain: true },
            options: { seed: 5, scroll: wheelScroll() },
            run: scrollDown,
        },
        {
            stage: { ...articleStage, label: 'scroll: trackpadScroll()' },
            options: { seed: 5 },
            run: scrollDown,
        },
    ],
}

// ---- scrolling a panel inside the page ----

const senders = [
    ['Linear', 'Weekly digest: 12 issues closed'],
    ['Figma', 'Ada shared “Checkout v3” with you'],
    ['GitHub', '[api] Release 4.2.0 is out'],
    ['Stripe', 'Your payout of $3,410 is on its way'],
    ['Notion', 'Q4 planning: comments on your page'],
    ['Vercel', 'Deployment ready: marketing-site'],
    ['Slack', '3 new messages in #launch'],
    ['Calendly', 'New meeting: Product demo, Thu 2pm'],
    ['Loom', 'Grace watched “Onboarding walkthrough”'],
    ['Intercom', '2 conversations waiting for a reply'],
    ['Sentry', 'Resolved: TypeError in checkout.ts'],
    ['Mailchimp', 'Your November campaign report'],
    ['HubSpot', 'Deal moved to “Contract sent”'],
    ['Zoom', 'Cloud recording is now available'],
]
const inboxRows = senders
    .map(([from, subject]) => `<div class="row"><b>${from}</b><span>${subject}</span></div>`)
    .join('')
const inboxStage = {
    label: 'Scrolling panels',
    css: `.app { position: fixed; top: 52px; bottom: 64px; left: 0; right: 0; display: flex;
        background: #fff; }
    nav { width: 130px; padding: 18px 14px; border-right: 1px solid var(--line); font-size: 15px;
        color: var(--muted); display: grid; align-content: start; gap: 6px; }
    nav .on { color: var(--ink); font-weight: 650; background: #eef2ff; border-radius: 8px;
        padding: 4px 10px; margin: 0 -10px; }
    #list { width: 280px; overflow: auto; border-right: 1px solid var(--line); }
    .row { padding: 10px 16px; border-bottom: 1px solid var(--line); font-size: 14px;
        line-height: 1.35; display: grid; cursor: default; }
    .row span { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row.picked { background: #eef2ff; box-shadow: inset 3px 0 var(--accent); }
    #invoice b { color: var(--accent); }
    #read { flex: 1; padding: 26px 24px; color: var(--muted); font-size: 15px; }
    #read h2 { color: var(--ink); font-size: 21px; margin: 0 0 6px; letter-spacing: -.02em; }
    #read .due { margin-top: 16px; padding: 12px 14px; border-radius: 10px; background: #f0fdf4;
        color: var(--good); font-weight: 600; }`,
    body: `<div class="app">
      <nav><span class="on">Inbox</span><span>Starred</span><span>Sent</span><span>Archive</span></nav>
      <div id="list">${inboxRows}<div class="row" id="invoice"><b>Northwind</b><span>Invoice #1042 for October</span></div>
        <div class="row"><b>Figma</b><span>New comment on “Pricing page”</span></div></div>
      <div id="read">Pick a message to read it.</div>
    </div>`,
    script: `document.getElementById('invoice').addEventListener('click', (e) => {
        e.currentTarget.classList.add('picked')
        document.getElementById('read').innerHTML =
            '<h2>Invoice #1042</h2>Northwind Traders · October<div class="due">$1,280 due Friday</div>'
    })`,
}

const panel: Scene = {
    name: 'scroll-panel',
    viewport: half,
    start: { x: 560, y: 330 },
    sides: [
        {
            stage: { ...inboxStage, label: 'Playwright on its own', plain: true },
            async run({ page, code }) {
                await page.waitForTimeout(700)
                await code("await page.click('#invoice')")
                await page.click('#invoice')
                await page.waitForTimeout(1200)
            },
        },
        {
            stage: { ...inboxStage, label: 'With definitely-not-a-robot' },
            options: { seed: 3 },
            async run({ page, human, code }) {
                await page.waitForTimeout(700)
                await code("await human.click('#invoice')  // wheels the list")
                await human.click('#invoice')
                await page.waitForTimeout(1200)
            },
        },
    ],
}

// ---- refusing to click through a cookie banner ----

const cover: Scene = {
    name: 'cookie-banner',
    viewport: wide,
    start: { x: 300, y: 300 },
    sides: [
        {
            stage: {
                label: 'Clicking safely',
                css: `main { display: grid; place-items: center; height: calc(100vh - 116px); }
                .card { width: 520px; padding: 28px; }
                .line { display: flex; justify-content: space-between; padding: 10px 0;
                    border-bottom: 1px solid var(--line); }
                .total { font-weight: 700; font-size: 20px; border: 0; }
                .btn { width: 100%; margin-top: 16px; padding: 14px; font-size: 18px; }
                .banner { position: fixed; left: 0; right: 0; bottom: 64px; padding: 26px 40px 40px;
                    display: flex; gap: 24px; align-items: center; justify-content: space-between;
                    background: #fff; border-top: 1px solid var(--line);
                    box-shadow: 0 -12px 32px rgba(15,23,42,.1); height: 230px; }
                .banner p { margin: 0; max-width: 700px; }
                .error { position: fixed; top: 76px; right: 24px; width: 520px; padding: 16px 18px;
                    border-radius: 12px; background: #fef2f2; border: 1px solid #fecaca;
                    color: #7f1d1d; font: 15px/1.5 ui-monospace, Menlo, monospace; display: none; }
                .error b { color: var(--bad); }
                .paid { color: var(--good); font-weight: 700; text-align: center; margin-top: 14px;
                    display: none; }`,
                body: `<main><div class="card">
                    <div class="line"><span>Robot vacuum</span><span>$249</span></div>
                    <div class="line"><span>Shipping</span><span>Free</span></div>
                    <div class="line total"><span>Total</span><span>$249</span></div>
                    <button class="btn" id="checkout">Checkout</button>
                    <div class="paid" id="paid">Order placed ✓</div></div></main>
                  <div class="banner cookie-banner" id="banner"><p>We use cookies to make this
                    site work. Choose what you're happy with.</p>
                    <button class="btn" id="accept">Accept all</button></div>
                  <div class="error" id="error"></div>`,
                script: `document.getElementById('accept').onclick = () => {
                    document.getElementById('banner').remove(); document.getElementById('error').style.display = 'none' }
                document.getElementById('checkout').onclick = () => { document.getElementById('paid').style.display = 'block' }
                window.showError = (code, message) => { const el = document.getElementById('error')
                    el.innerHTML = '<b>' + code + '</b><br>' + escape(message)
                    el.style.display = 'block' }`,
            },
            options: { seed: 2 },
            async run({ page, human, code }) {
                await code("await human.click('#checkout')")
                try {
                    await human.click('#checkout', { timeout: 1500 })
                } catch (error) {
                    const { code: name, message } = error as { code: string; message: string }
                    await page.evaluate(
                        ([c, m]) => (window as any).showError(c, m),
                        [name, message]
                    )
                }
                await page.waitForTimeout(1800)
                await code("await human.click('#accept')")
                await human.click('#accept')
                await code("await human.click('#checkout')")
                await human.click('#checkout')
            },
        },
    ],
}

// ---- seeds ----

const seedTargets = [
    { id: 's1', x: 560, y: 130 },
    { id: 's2', x: 150, y: 260 },
    { id: 's3', x: 520, y: 380 },
]

const seedSide = (run: number): Side => ({
    stage: {
        label: `seed 42, run ${run}`,
        ...dotStage(seedTargets, 56),
    },
    options: { seed: 42, plugins: [trail({ fade: 6000 })] },
    async run({ human, code }) {
        for (const d of seedTargets) {
            await code(`await human.click('#${d.id}')  // seed: 42`)
            await human.click(`#${d.id}`)
        }
    },
})

const seed: Scene = {
    name: 'seed-replay',
    viewport: half,
    start: { x: 120, y: 440 },
    sides: [seedSide(1), seedSide(2)],
}

// ---- what an analytics script sees from each sign-up ----

const analyticsStage = {
    css: `${signupCss}
    main { grid-template-columns: 360px 210px; gap: 18px; place-content: center; }
    #card { width: 100%; padding: 24px; }
    .panel { width: auto; padding: 18px; }
    .panel h2 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em;
        color: var(--muted); }
    dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 0 0 14px; font-size: 15px; }
    dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }
    canvas { display: block; border-radius: 8px; background: var(--bg);
        border: 1px solid var(--line); }`,
    body: signupBody.replace(
        '</main>',
        `<aside class="card panel"><h2>What analytics saw</h2>
        <dl><dt>Pointer moves</dt><dd id="n-pointermove">0</dd><dt>Key presses</dt><dd id="n-keydown">0</dd>
        <dt>Clicks</dt><dd id="n-click">0</dd></dl><canvas id="heat" width="172" height="129"></canvas></aside></main>`
    ),
    script: `${signupScript}
    const counts = { pointermove: 0, keydown: 0, click: 0 }
    const heat = document.getElementById('heat').getContext('2d')
    const { width, height } = heat.canvas
    window.resetCounts = () => { heat.clearRect(0, 0, width, height)
        for (const type in counts) document.getElementById('n-' + type).textContent = counts[type] = 0 }
    for (const type in counts) addEventListener(type, (e) => {
        document.getElementById('n-' + type).textContent = ++counts[type]
        if (type !== 'pointermove') return
        heat.fillStyle = 'rgba(79, 70, 229, .45)'; heat.beginPath()
        heat.arc(e.clientX * width / innerWidth, e.clientY * height / innerHeight, 2.5, 0, 7); heat.fill()
    }, true)`,
}

/** Zeroes the panel first, so it counts only what the sign-up sends. */
const counted = (run: Side['run']) => async (take: Take) => {
    await take.page.evaluate(() => (window as any).resetCounts())
    await run(take)
}

const analytics: Scene = {
    name: 'analytics',
    viewport: half,
    start: { x: 560, y: 470 },
    sides: [
        {
            stage: { label: 'Playwright on its own', plain: true, ...analyticsStage },
            run: counted(fillSignUp),
        },
        {
            stage: { label: 'With definitely-not-a-robot', ...analyticsStage },
            options: { speed: 1.4 },
            run: counted(signUp),
        },
    ],
}

// ---- widgets that need real input: search on keyup and a signature pad ----

const widgetStage = {
    css: `main { display: grid; place-items: center; height: calc(100vh - 116px); }
    .card { width: 460px; padding: 22px 28px; }
    label { display: block; font-size: 15px; font-weight: 600; margin: 0 0 6px; }
    ul { list-style: none; margin: 6px 0 12px; padding: 0; height: 70px; }
    li { padding: 5px 12px; margin-bottom: 4px; border-radius: 8px; background: #eef2ff;
        color: var(--accent); font-weight: 500; }
    canvas { display: block; background: var(--bg); border: 1px dashed #94a3b8; border-radius: 10px; }
    #signed { margin: 8px 0 0; font-weight: 600; color: var(--muted); }
    #signed.good { color: var(--good); } #signed.bad { color: var(--bad); }`,
    body: `<main><div class="card">
      <label for="search">Search fruit</label><input id="search" autocomplete="off">
      <ul id="suggestions"></ul>
      <label>Sign here</label><canvas id="pad" width="402" height="120"></canvas>
      <p id="signed">Waiting for a signature</p>
    </div></main>`,
    script: `const search = document.getElementById('search')
    search.addEventListener('keyup', () => {
        document.getElementById('suggestions').innerHTML = ['apple', 'apricot', 'banana', 'blueberry']
            .filter((f) => f.startsWith(search.value)).map((f) => '<li>' + f + '</li>').join('') })
    const pad = document.getElementById('pad'), ink = pad.getContext('2d'), signed = document.getElementById('signed')
    ink.lineWidth = 3; ink.lineCap = ink.lineJoin = 'round'; ink.strokeStyle = '#4f46e5'
    let points = 0
    pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); points = 1; ink.beginPath(); ink.moveTo(e.offsetX, e.offsetY) })
    pad.addEventListener('pointermove', (e) => { if (!e.buttons) return
        points++; ink.lineTo(e.offsetX, e.offsetY); ink.stroke() })
    pad.addEventListener('pointerup', () => { const ok = points > 10
        signed.textContent = ok ? 'Signed ✓' : 'Too short, sign again'; signed.className = ok ? 'good' : 'bad' })`,
}

/** Where the signature starts and ends, inside the pad. */
const stroke = { from: { x: 50, y: 85 }, to: { x: 350, y: 40 } }

const realInput: Scene = {
    name: 'real-input',
    viewport: half,
    start: { x: 560, y: 470 },
    sides: [
        {
            stage: { label: 'Playwright on its own', plain: true, ...widgetStage },
            async run({ page, code }) {
                await page.waitForTimeout(500)
                await code("await page.fill('#search', 'apr')")
                await page.fill('#search', 'apr')
                await page.waitForTimeout(1200)
                await code("await page.dragAndDrop('#pad', '#pad', { … })")
                await page.dragAndDrop('#pad', '#pad', {
                    sourcePosition: stroke.from,
                    targetPosition: stroke.to,
                })
            },
        },
        {
            stage: { label: 'With definitely-not-a-robot', ...widgetStage },
            options: { seed: 5 },
            async run({ page, human, code }) {
                await code("await human.type('#search', 'apr')")
                await human.type('#search', 'apr')
                await page.waitForTimeout(500)
                const pad = (await page.locator('#pad').boundingBox())!
                const at = (p: { x: number; y: number }) => ({ x: pad.x + p.x, y: pad.y + p.y })
                await code('await human.drag(from, to)')
                await human.drag(at(stroke.from), at(stroke.to))
            },
        },
    ],
}

export const scenes: Scene[] = [
    hero,
    curve,
    hover,
    drag,
    typing,
    scroll,
    trackpad,
    panel,
    cover,
    seed,
    fixture,
    realInput,
    analytics,
    puppeteerScene,
]
