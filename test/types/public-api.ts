// Compiled by `pnpm typecheck`, never run. Checks the public types against Playwright's real ones:
// what should compile does, and `@ts-expect-error` marks what must not.
import type { Frame, Locator, Page } from 'playwright'
import { createHuman, type defineDriver, type Human } from '../../src'

declare const page: Page
declare const frame: Frame
declare const locator: Locator

const human: Human<Page> = createHuman(page, { preset: 'fast', seed: 1 })
human.click(locator)
human.click({ x: 10, y: 20 })
human.scroll({ to: locator })
human.scroll({ to: 'bottom' })
human.type('#email', 'ada@example.com', { clear: true })

// @ts-expect-error a frame isn't a page
createHuman(frame)
// @ts-expect-error nor is a number
createHuman(42)
// @ts-expect-error scrolling to a point is meaningless: it's already on screen
human.scroll({ to: { x: 10, y: 20 } })

// Anything goes with your own driver.
declare const driver: ReturnType<typeof defineDriver>
createHuman({ custom: true }, { driver })
