# definitely-not-a-robot 🤖

**Your Playwright scripts click like robots. Make them move like people.**

One line wraps any Playwright page. Clicks travel curved paths and land where a hand would.
Typing has a real rhythm. Scrolling turns the wheel. And the same seed replays the same run,
every time.

[![npm](https://img.shields.io/npm/v/definitely-not-a-robot?color=111)](https://www.npmjs.com/package/definitely-not-a-robot)
[![types](https://img.shields.io/badge/types-included-111)](#api)
[![dependencies](https://img.shields.io/badge/dependencies-0-111)](package.json)
[![license](https://img.shields.io/badge/license-MIT-111)](LICENSE)

```bash
npm install definitely-not-a-robot
```

## Quickstart

```js
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
```

Run it and watch: the cursor arcs over to the field, the text goes in key by key, and the
checkbox gets clicked a little off-centre, the way you'd click it.

## Why

Playwright is built for speed. `click()` teleports the mouse to the exact centre of an element and
`fill()` pastes text in one go. That's perfect when a test only cares about the end result, and
wrong when your automation needs to look or behave like a person:

- **Demo videos look robotic.** The cursor jumps, and text appears all at once.
- **Bugs that need real input stay hidden.** Hover menus, debounced search boxes, drag and drop,
  and validation that runs on each keystroke only fire on the events a person produces.
- **Testing your own analytics, heatmaps or bot defences** needs sessions that move like users,
  not like scripts.

## What you get

- **Mouse paths that arc**, timed by Fitts's law: far, small targets take longer than near, big
  ones. Long moves sometimes overshoot and correct, and the hand has a slight tremor.
- **Clicks that land where people click**: near the centre, never the edge. They also refuse to
  click through a cookie banner or modal that's covering the target, and tell you what's in the way.
- **Typing with rhythm**: uneven gaps between keys, faster common letter pairs, pauses between
  words and sentences, Shift held for capitals, and optional typos that get noticed and fixed.
- **Wheel scrolling** in notches and bursts. Targets off-screen are scrolled into view before
  the cursor heads for them.
- **Hover, drag and drop, double-click, right-click and key combinations.**
- **Seeds**: `createHuman(page, { seed: 42 })` replays identical paths and timings, so a flaky
  run can be reproduced and a demo video re-recorded frame for frame.
- **Instant mode for CI**: set `DNAR_SPEED=instant` and the same script runs at full speed. It
  sends the same kinds of events, with no waiting.
- **Built to extend**: presets, swappable motion, typing and scroll strategies, plugins, and
  custom drivers.
- **No dependencies.** TypeScript types included, ESM and CommonJS, Node 18+. Works with
  `playwright`, `playwright-core` and `@playwright/test`.

## API

```ts
const human = createHuman(page, options?)
```

| Method | What it does |
| --- | --- |
| `human.click(target, { button?, clickCount? })` | Moves to the target, hesitates, presses, holds, releases |
| `human.doubleClick(target)` | Two quick clicks the page sees as a double-click |
| `human.move(target)` | Moves along a curved path without clicking |
| `human.hover(target)` | Moves there and lingers, so menus and tooltips open |
| `human.drag(from, to)` | Presses on `from`, carries it along a human path, releases on `to` |
| `human.type(target, text, { clear? })` | Clicks the field and types at the end of what's there. `clear: true` replaces it |
| `human.type(text)` | Types into whatever has focus |
| `human.press(keys)` | A key or combination: `'Enter'`, `'Shift+Tab'`, `'ControlOrMeta+A'` |
| `human.scroll({ by })` / `human.scroll({ to })` | Wheel by pixels, or to an element, `'top'` or `'bottom'` |
| `human.pause()` / `human.pause(ms)` / `human.pause(min, max)` | Waits like a person thinking |
| `human.seed` | The seed in use. Log it to replay a run |
| `human.position` | Where the cursor is |

A **target** is a selector (`'#email'`, `'text=Sign up'`), a Playwright locator
(`page.getByRole('button', { name: 'Sign up' })`), an element handle, or a point
(`{ x: 200, y: 340 }`). Every action waits for its target to be visible, the way Playwright's
own actions do.

### Options

| Option | Default | What it does |
| --- | --- | --- |
| `preset` | `'average'` | `'average'`, `'careful'` or `'fast'`, or your own preset object |
| `seed` | random | Replays identical movement and timing |
| `speed` | `1` | Multiplies every timing. `2` is twice as fast; `'instant'` skips waiting |
| `typing` | 65 wpm | `{ wpm, variance, typos }`, or your own typing strategy |
| `motion` | Bezier | `{ fitts, curvature, overshoot, tremor }`, or your own motion strategy |
| `scroll` | wheel | `{ notch, burst }`, or your own scroll strategy |
| `timing` | | `{ hesitation, hoverDwell, think, clickHold, doubleClickGap }` as `[min, max]` ms |
| `timeout` | `10000` | How long to wait for a target to appear, in ms |
| `plugins` | `[]` | Hooks that run around actions and cursor moves |
| `startPosition` | lower middle | Where the cursor starts |
| `driver` | detected | Drive something other than a Playwright page |

## Recipes

### Run at full speed in CI

```bash
DNAR_SPEED=instant npx playwright test
```

The environment variable overrides `speed` in code, so the same script is human when you watch it
and fast when CI runs it. Instant mode skips `human.pause()` too, so wait for the page with
Playwright's `expect` or `waitFor`, not with a pause.

### Replay a run exactly

```js
const human = createHuman(page)
console.log('seed', human.seed) // e.g. 1842273

// Later, to reproduce it:
const replay = createHuman(page, { seed: 1842273 })
```

### Type faster, slower, or sloppier

```js
createHuman(page, { typing: { wpm: 90, typos: 0.02 } })
createHuman(page, { preset: 'careful' }) // 42 wpm, longer pauses
```

### Write your own motion

A strategy is just an object with a `plan` function that returns timed points. Here's a cursor
that moves in a straight line at constant speed:

```ts
import { createHuman, defineMotion } from 'definitely-not-a-robot'

const straight = defineMotion({
    name: 'straight',
    plan: ({ from, to }) =>
        Array.from({ length: 20 }, (_, i) => {
            const k = (i + 1) / 20
            return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, t: i * 16 }
        }),
})

createHuman(page, { motion: straight })
```

Typing (`defineTyping`) and scrolling (`defineScroll`) work the same way.

### Hook into every action

```ts
import { createHuman, definePlugin } from 'definitely-not-a-robot'

const log = definePlugin({
    name: 'log',
    beforeAction: (action) => console.log('→', action.type, action.target ?? action.text ?? ''),
})

createHuman(page, { plugins: [log] })
```

### Drive something else

Everything that talks to the browser goes through a small `Driver` interface: mouse move, down
and up, wheel, key down and up, insert text, viewport, scroll offset, and finding an element.
Implement it with `defineDriver()` and pass it as `{ driver }`.

## How it works

Every action is **planned, then played**. Planning is pure maths: a Bezier curve timed by Fitts's
law and eased the way an arm accelerates, a list of keystrokes with human gaps, a series of wheel
notches. Playing sends those steps to the browser on a clock. If the browser is slow or remote,
it drops points rather than running late, so a movement takes as long as a person would take.

All randomness comes from one seeded generator, which is why a seed replays a run exactly.
New to the terms? There's a plain-language [glossary](docs/GLOSSARY.md).

## Responsible use

This library makes **input** look human. It doesn't hide that a browser is automated, patch
fingerprints, or solve CAPTCHAs, and it isn't meant to get around anyone's bot protection. Use it
on sites you own or have permission to automate: demos, tests and research.

## FAQ

**Will this get me past bot detection?** No, and it isn't built to. Modern detection looks at much
more than mouse movement.

**Does it work with `@playwright/test`?** Yes. Pass the test's `page` to `createHuman`.

**Does it work with Puppeteer?** Not yet. Playwright only for now.

**Why are my tests slower?** Human timing takes human time. Use `DNAR_SPEED=instant` in CI, or
`speed: 2` to halve it.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT © Doug Silkstone
