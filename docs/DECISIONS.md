# Decisions

Settled choices. Don't relitigate; add new calls with a date.

## How autopilot runs here

- **Status**: Running
- **Ship rights**: push, merge to `main` and deploy the docs site without asking each time. Given
  2026-11-03 when the user ran `/autopilot` with "Redesign and rewrite this library from scratch,
  including a factory pattern for extensibility and playwright support by default". Ship rights do
  **not** cover `npm publish`: the npm CLI isn't logged in and a first public release is the
  user's call (see Needs you in the backlog).
- **Base branch**: `main` (not protected, nothing deploys on push). Claims are pushed straight to
  `main` as `docs: claim PRD <nn>`.
- **Deploy targets**:
  - The library ships to npm as `definitely-not-a-robot` once the user publishes it.
  - The docs and landing site deploys to Railway (PRD 07). Recipe goes in `docs/DEPLOY.md` when
    that PRD ships.
- **The real surface**: a stranger installing the packed tarball into an empty folder and running
  the README quickstart against a real page in Chromium (`pnpm smoke`). After PRD 07, the landing
  site's production URL.
- **Test account**: none needed (no accounts).
- **Third-party services**: Railway, for this project's own services only. GitHub: this repo
  only (settings, Actions, releases). npm: read-only until the user logs in and says publish.

## Product

- **What it is**: human-like mouse, keyboard and scroll input for Playwright, as a small typed
  library. Playwright is the default and needs no setup; Puppeteer works through an adapter.
- **Who it's for**: developers who already drive Playwright and need input that looks like a
  person: product demo videos recorded from scripts, end-to-end tests that fire the events real
  users fire, and teams testing their own analytics, heatmaps or bot defences.
- **Positioning** (2026-11-03): "Your Playwright scripts click like robots. Make them move like
  people." The wedge (see `docs/MARKET.md`): every input humanized (mouse, keyboard, scroll) and
  reproducible with seeds, which nobody else offers. For videos: "Playwright draws a cursor. We
  move the real one." Playwright 1.64 paints a decorative cursor on recordings; ours sends real
  events along the path, so hover states fire, and the visible cursor shows what the page got.
- **Competitors in public copy**: not named in the README, site or package keywords until the user
  approves each name (they're in Needs you).
- **Name**: keep `definitely-not-a-robot` (free on npm as of 2026-11-03).
- **Scope line** (2026-11-03): the library makes *input* human. It does not hide browser
  fingerprints, patch automation flags or solve CAPTCHAs, and the old stealth plugin is gone. The
  README says so plainly in a "Responsible use" section. People who want stealth can pass in a page
  from whatever browser they like.

## Architecture

- **Factory, not class**: `createHuman(page, options)` returns a `Human`. No `new`, no
  `launch()`: the user brings their own Playwright page, so the library never owns the browser.
- **Drivers (adapter pattern)**: everything that talks to the automation library sits behind a
  small `Driver` interface (mouse move/down/up, wheel, key down/up, insert text, viewport, scroll
  offset, locate a target, inject a script).
- **Click safety**: before pressing, an in-page hit test checks that the topmost element at the
  click point is the target (through shadow roots, labels count). If something covers it, wait
  until timeout, then throw `TARGET_COVERED` naming what's on top. `{ force: true }` skips it.
- **Clock**: the player schedules points against an absolute clock and drops points when behind,
  so a slow or remote browser keeps human durations instead of running long. `createHuman` detects Playwright or Puppeteer pages by shape.
  Custom drivers via `defineDriver()`.
- **Plan, then play**: motion, typing and scrolling are planned by pure functions that return
  timed steps (`{ x, y, t }[]`, keystrokes with delays, wheel deltas). A small player sends them
  through the driver on an absolute clock. Pure planners are unit-tested without a browser and
  can run anywhere (the landing page demo runs the real planner in the browser).
- **Strategies**: `motion`, `typing` and `scroll` behaviour are swappable strategy objects made by
  factories (`bezierMotion()`, `naturalTyping()`, …). `defineMotion()` etc. give type inference
  for custom ones.
- **Presets**: named bundles of options (`'average'` default, `'careful'`, `'fast'`, `'demo'`).
- **Plugins**: lifecycle hooks (`setup`, `beforeAction`, `afterAction`, `onMove`), used for the
  visible cursor, the debug trail and logging. `definePlugin()` for custom ones.
- **Seeded randomness**: every random number flows from one seedable generator, so `seed: 42`
  replays the same paths and timings. Default is a random seed.
- **Speed**: `speed` multiplies all timings; `speed: 'instant'` keeps the same event types with no
  waiting, for CI. The `DNAR_SPEED` environment variable overrides it without code changes.
- **No runtime dependencies**. Playwright types are matched structurally, so the core works with
  `playwright`, `playwright-core` or `@playwright/test`. `@playwright/test` is an optional peer
  for the test fixture entry only.
- **Entry points**: `definitely-not-a-robot` (core), `definitely-not-a-robot/playwright` (test
  fixture). More only when a PRD needs one.

## Stack and conventions

- TypeScript 7 (strict), ESM and CommonJS builds with type declarations via tsdown, Node 18+.
- Build moved from tsup to tsdown (2026-11-03, when the user asked for every dependency on its
  latest release): tsup 9 calls TypeScript's JS compiler API for declarations, which TypeScript 7
  no longer ships; tsdown supports 7. The build runs publint and arethetypeswrong, so a wrong
  `exports` path fails `pnpm build` instead of reaching users.
- Dependencies stay on their latest releases. CI's GitHub Actions too.
- pnpm. Add packages with `pnpm add <pkg>@latest`, never by hand-editing versions.
- Vitest for unit tests; integration tests drive real headless Chromium through Playwright.
- Biome for lint and format: 4 spaces, single quotes, no semicolons, 100 columns (the repo's old
  Prettier style).
- Gates before merging: `pnpm check` (types, lint, unit + integration tests, build) and
  `pnpm smoke` (pack, install into an empty folder, run the quickstart).
- One feature per commit, plain messages, changelog entry in the same commit.
- Every user-visible feature ships with a short demo video of it in action, recorded by the
  library itself (`pnpm demos`, from PRD 02 on), shown in the README and on the site.

## User's calls

- 2026-11-03: rewrite from scratch, factory pattern for extensibility, Playwright by default.
  Teach the terminology as we go (reports carry a short "Terms" section; `docs/GLOSSARY.md`
  collects them). Focus on user experience and think commercially: messaging and pain points.
- 2026-11-03: "It's important to create demo videos of each feature in action too." Every feature
  gets a video (convention above); PRD 02 records them for everything shipped so far.
