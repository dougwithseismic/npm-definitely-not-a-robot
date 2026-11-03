# PRD 01: Core engine and factory

## Goal

Replace the old Puppeteer class with a small, typed library that wraps any Playwright page and
gives it human input in one line:

```ts
const human = createHuman(page)
await human.click('text=Sign up')
await human.type('#email', 'ada@example.com')
```

This PRD fixes the contract every later PRD builds on: the `Human` API, the options, the driver
interface, the strategy and plugin shapes.

## Locked decisions

- See `docs/DECISIONS.md` → Architecture. Factory function, drivers, plan-then-play, strategies,
  presets, plugins, seeded randomness, speed and `DNAR_SPEED`, no runtime dependencies.
- Old code is deleted, not ported. Known problems it had, for the record: importing the package
  launched a browser (the demo ran from `index.ts`); mouse position was a module-level global
  shared by every instance; debug drawing was forced on inside `jitterMouse`; Puppeteer was a dev
  dependency but needed at runtime, so installs broke; the Bezier timing added `speed` to `t`, so
  the cursor skipped the start of every curve; the package name was still the template's.

## The API

```ts
createHuman(page, options?) → Human

human.move(target, opts?)            // curved path to the target, no click
human.hover(target, opts?)           // move, then dwell briefly
human.click(target, opts?)           // move, hesitate, press, hold, release
human.doubleClick(target, opts?)
human.drag(from, to, opts?)
human.type(text) / human.type(target, text, opts?)   // click target first when given
human.press(key, opts?)              // 'Enter', 'Control+A'
human.scroll({ by } | { to: target | 'top' | 'bottom' })
human.pause(ms?) / human.pause(min, max)
human.position                       // last known cursor position
human.page                           // the page passed in
```

Targets: a selector string, a Playwright `Locator`, an element handle, or a point `{ x, y }`.

Options (all optional): `preset`, `seed`, `speed`, `motion`, `typing`, `scroll`, `plugins`,
`timeout`, `startPosition`.

## Acceptance criteria

- WHEN `createHuman` is given a Playwright page THE system SHALL return a `Human` without
  launching or touching a browser of its own.
- WHEN it is given anything that isn't a supported page THE system SHALL throw a `HumanError` with
  code `UNSUPPORTED_PAGE` that names what it expected and what it got.
- WHEN `human.click(selector)` runs THE page SHALL receive a series of `mousemove` events along a
  curved (non-straight) path, then `mousedown`/`mouseup` inside the target's box, then `click`.
- WHEN the move is long THE path SHALL sometimes overshoot and correct, and its duration SHALL grow
  with distance and shrink with target size (Fitts's law).
- WHEN the target is outside the viewport THE system SHALL scroll it into view with wheel events
  before moving to it.
- WHEN the target doesn't appear within `timeout` THE system SHALL throw `TARGET_NOT_FOUND`
  (or `TARGET_NOT_VISIBLE` if it exists but has no box) with the selector and a hint.
- WHEN `human.type(target, text)` runs THE field SHALL end up containing exactly `text`, with one
  keydown/keyup pair per character and varied intervals between them, including when typos are on.
- WHEN `human.scroll({ by: 1200 })` runs THE page SHALL scroll by about 1200 px through several
  wheel events, not one jump.
- WHEN two humans are created with the same `seed` on the same page THE planned paths and timings
  SHALL be identical.
- WHEN `speed: 'instant'` is set, or `DNAR_SPEED=instant`, THE actions SHALL complete without
  deliberate waits and still land correctly.
- WHEN two humans exist at once THE cursor position of one SHALL NOT affect the other.
- WHEN the package is imported THE import SHALL have no side effects.
- The package builds to ESM + CJS + `.d.ts`, has no runtime dependencies, and `pnpm check` passes.

## Tasks

1. Tooling: pnpm, TypeScript, tsup, Vitest, Biome, scripts (`check`, `smoke`). Delete old code.
2. `src/random.ts`: seeded generator (Mulberry32) with helpers: range, int, gaussian, chance, pick.
3. `src/geometry.ts`: points, boxes, distance, Bezier evaluation, target point inside a box.
4. `src/motion/`: `bezierMotion()` planner with Fitts duration, minimum-jerk easing, overshoot,
   tremor; returns `{ x, y, t }[]`.
5. `src/typing/`: `naturalTyping()` planner: WPM base, log-normal variation, faster common pairs,
   pauses at word and sentence ends, optional QWERTY-neighbour typos with correction.
6. `src/scroll/`: `wheelScroll()` planner: notch-sized deltas with ease-out and short gaps.
7. `src/drivers/`: `Driver` interface, `playwrightDriver()`, detection, `defineDriver()`.
8. `src/human.ts`: `createHuman`, the action methods, the player (absolute clock, speed),
   plugin hooks, error mapping.
9. `src/presets.ts`, `src/errors.ts`, `src/index.ts` exports.
10. Unit tests for planners and random; integration tests in headless Chromium on a fixture page
    that records events.
11. `scripts/smoke.mjs`: pack, install into a temp folder, run the quickstart.

## Implementation Notes

Shipped 2026-11-03.

- **Layout**: `src/random.ts` (Mulberry32 + Box–Muller), `src/geometry.ts`, `src/motion/`,
  `src/typing/`, `src/scroll/`, `src/drivers/` (`types.ts` contract, `playwright.ts`,
  `hit-test.ts` in-page check), `src/presets.ts`, `src/plugins/`, `src/errors.ts`,
  `src/human.ts` (factory, player, actions), `src/index.ts`.
- **Beyond the PRD**, from the market scan: an in-page hit test before every press
  (`TARGET_COVERED`, `{ force: true }`), and a player that drops points when the browser lags.
  Both answer top complaints about the incumbent.
- **Strategy options merge**: `typing: { typos: 0.02 }` on top of `preset: 'fast'` keeps the
  preset's 95 wpm; passing a strategy object (with `plan`) replaces wholesale.
- **Actions are queued**: calls run in order even without `await`, so `Promise.all` can't
  interleave two cursor paths.
- **Keys**: printable ASCII goes through key down/up (Shift held for capitals and symbols);
  everything else (emoji, accents) through `insertText`. In combinations (`ControlOrMeta+A`) the
  letter is the key, with no Shift.
- **Numbers**: bundle 36 KB ESM / 37 KB CJS unminified, 17 KB of declarations, 0 dependencies.
  60 tests (22 unit, 38 in headless Chromium 156), plus compile-time checks of the public types
  against Playwright's real `Page`, `Frame` and `Locator` (`test/types/public-api.ts`). `pnpm smoke` passes: packed tarball into an
  empty folder, README quickstart against demo.playwright.dev, CJS require, type check against
  Playwright 1.64.1's real `Page`.
- **Tooling note**: TypeScript held on 6.x because tsup's declaration bundling needs the compiler
  API that TS 7 dropped. Superseded 2026-11-03: the build moved to tsdown, on TS 7 (see
  DECISIONS).
- **Review fixes** (a review agent ran experiments in Chromium and confirmed 15 defects; all
  fixed, each with a regression test in `test/integration/edge-cases.test.ts`):
  - Hit test works inside iframes: the top-level point is shifted into frame pixels by the
    difference between Playwright's box and the element's own rect. It now tells *clipped*
    (scrolled out of a panel or frame) from *covered*; clipped targets get one
    `scrollIntoViewIfNeeded`, and `force` never presses on a clipped target.
  - `ElementRef.waitForVisible` resolves false on timeout (the driver knows its own timeout
    error); strict-mode violations become `TARGET_AMBIGUOUS`; other errors pass through.
  - Seeds replay regardless of polling: `aim` draws one `spot` per aim and places it in whatever
    box the retries see, each action draws from its own stream of the seed (`streamSeed`), and
    plugins get a stream of their own.
  - Plugins get an unqueued, hookless human (no deadlock); a failed `setup` is retried.
  - `press('+')`, `\r\n` and `\t` typed exactly, `timeout` and strategy options validated
    (`INVALID_OPTION`), nested options deep-merge, edge-margin targets are wheeled,
    `scrollOffset(at)` measures the scroll box under the cursor, `type` appends via an optional
    `ElementRef.caretToEnd`, the course correction re-aims, `createHuman` only accepts a page
    (or anything with `{ driver }`) at compile time, `scroll({ to })` no longer accepts points.
- **Open**: Puppeteer driver (PRD 06). Targets in scrolling panels and iframes are scrolled with
  `scrollIntoViewIfNeeded`, not the wheel over the panel (done 2026-11-03: the hit test reports
  the clip of wheel-scrollable panels and frames, and the cursor wheels over it; a panel mostly
  off screen waits for the page to scroll first, and a frame's clip doesn't include panels in the
  parent page around it, so those fall back to the instant scroll). A parent-page element
  covering an iframe isn't detected (cross-origin frames can't see their parent). Email and
  number inputs don't support moving the caret, so typing there lands where the click did.
