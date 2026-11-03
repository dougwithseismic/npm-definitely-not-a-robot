import {
    test as base,
    type Page,
    type PlaywrightTestArgs,
    type PlaywrightTestOptions,
    type PlaywrightWorkerArgs,
    type PlaywrightWorkerOptions,
    type TestType,
} from '@playwright/test'
import { createHuman, type Human, type HumanOptions } from './human'

export interface HumanFixtures {
    /** A human for this test's `page`, made with `humanOptions`. */
    human: Human<Page>
    /** Options for `human`. Set them with `test.use({ humanOptions: { preset: 'demo' } })`. */
    humanOptions: HumanOptions
}

/**
 * Playwright Test's `test` with a `human` next to `page`:
 *
 * ```ts
 * import { test, expect } from 'definitely-not-a-robot/playwright'
 *
 * test('sign up', async ({ page, human }) => {
 *     await page.goto('/')
 *     await human.click('text=Sign up')
 * })
 * ```
 *
 * Already have your own `test`? Combine them with Playwright's `mergeTests(yours, test)`.
 */
// Typed by hand: left to inference, the declaration names Playwright's internal `playwright/test`
// module, which users can't resolve from here, and the build would copy all of its types in.
export const test: TestType<
    PlaywrightTestArgs & PlaywrightTestOptions & HumanFixtures,
    PlaywrightWorkerArgs & PlaywrightWorkerOptions
> = base.extend<HumanFixtures>({
    humanOptions: [{}, { option: true }],
    human: async ({ page, humanOptions }, use) => {
        await use(createHuman(page, humanOptions))
    },
})

export { expect } from '@playwright/test'
export * from './index'
