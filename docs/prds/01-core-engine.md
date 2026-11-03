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

(Filled in after shipping.)
