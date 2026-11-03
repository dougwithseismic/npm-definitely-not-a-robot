# PRD 03: Playwright Test fixture

## Goal

People who use `@playwright/test` should get a `human` next to `page` with one import change:

```ts
import { test, expect } from 'definitely-not-a-robot/playwright'

test('sign up', async ({ page, human }) => {
    await page.goto('/')
    await human.click('text=Sign up')
})
```

## Acceptance criteria

- WHEN a test imports `test` from `definitely-not-a-robot/playwright` THE `human` fixture SHALL
  wrap that test's `page`.
- WHEN `test.use({ humanOptions: { preset: 'demo' } })` is set THE fixture SHALL use those options.
- WHEN running in CI (`CI` set) THE default speed SHALL stay human unless `DNAR_SPEED` is set, and
  the docs SHALL show the one-line CI switch.
- `@playwright/test` is an optional peer dependency; the core entry never imports it.

## Implementation Notes

Shipped 2026-11-03.

- `src/playwright.ts` is a second entry, `definitely-not-a-robot/playwright`: `base.extend` with a
  `humanOptions` option fixture and a lazy `human` fixture, plus `expect` and everything from the core
  entry. `@playwright/test` is an optional peer (`>=1.40.0`), and only this entry imports it.
- The exported `test` is typed by hand. Left to inference, its declaration named Playwright's
  internal `playwright/test` module, which isn't resolvable from a user's project, so the build
  inlined all of it: `playwright.d.ts` was 2.32 MB. Now 2.9 kB.
- `typesVersions` points the subpath at `playwright.d.cts` for TypeScript's old `node` resolution,
  and the build runs arethetypeswrong at the strict profile, so all resolution modes are checked.
- CI behaviour: nothing switches on its own. Under `CI` with no `DNAR_SPEED`, a long move takes most
  of a second, which a fixture test asserts. The README shows `DNAR_SPEED=instant` as the switch.
- Instant mode was barely faster than human speed for mouse moves (750–980 ms for a long move): it
  sent every planned point, and each is a browser round trip. It now cuts a path into 8 runs and
  sends the last point of each (about 133 ms against 830–1120 ms at human speed), and merges wheel
  notches the same way, summing each run's distance. The path and notches are still planned in
  full, so a seed draws the same random numbers at any speed. Drags still send every point, since
  pages read each move while a button is held.
- Tests: `pnpm test:fixture` runs four Playwright Test specs (`test/playwright`): the page wiring,
  CI speed, `test.use`, `mergeTests`. `pnpm check` includes it. Smoke installs `@playwright/test`
  into a fresh project after the core checks pass without it, runs the README's `todo.spec.ts`
  through the fixture, `require`s the entry from CommonJS, and type-checks a config typed with
  `defineConfig<HumanFixtures>`.
- Demo: `playwright-test` (9.7 s, GIF 520 KB, MP4 69 KB). It was first filmed by running Playwright
  Test with `video: 'on'`, but the fixture only calls `createHuman(page, humanOptions)`, so the
  frames were the same as the normal recorder's; it now goes through `film()` like every scene.

Open:

- The peer range claims 1.40, but only 1.64 is tested.
