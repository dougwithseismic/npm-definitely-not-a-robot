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
