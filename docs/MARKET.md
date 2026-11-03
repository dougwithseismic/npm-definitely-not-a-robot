# Market (scanned 2026-11-03)

Downloads are npm last-week figures (2026-10-26 to 11-01). Facts are from public npm, GitHub and
docs pages on the scan date.

## The buyer and the job

Developers who already write Playwright scripts. They want automated input that looks or behaves
like a person, for three jobs:

1. **Demo and marketing videos** recorded from scripts. They want to re-record when the UI changes
   instead of filming by hand.
2. **End-to-end tests that need real input**: hover menus, debounced search, drag and drop,
   validation that runs on each keystroke.
3. **Testing their own analytics, heatmaps or bot defences** with synthetic sessions.

Today they use ghost-cursor or one of its many forks for the mouse, write their own typing loop
with `keyboard.type({ delay })`, or put up with Playwright teleporting the mouse.

## Alternatives

| Name | Who it's for | Downloads/wk | Strong at | Complaints (sourced) |
|------|--------------|--------------|-----------|----------------------|
| ghost-cursor | Puppeteer users | 92,237 | The reference Bezier and overshoot algorithm; scroll; 1.6k stars | Crashes on Playwright ([#121](https://github.com/Xetera/ghost-cursor/issues/121), open since 2024); no typing ([#103](https://github.com/Xetera/ghost-cursor/issues/103), open since 2023); CJS named-import errors ([#34](https://github.com/Xetera/ghost-cursor/issues/34)); slow on remote browsers ([#168](https://github.com/Xetera/ghost-cursor/issues/168)); clicks land on adjacent elements ([#120](https://github.com/Xetera/ghost-cursor/issues/120)) |
| ghost-cursor-playwright | Playwright users | 7,651 | Closest Playwright port; auto-scroll | Mouse teleports ([#5](https://github.com/reaz1995/ghost-cursor-playwright/issues/5)); breaks under CSP ([#9](https://github.com/reaz1995/ghost-cursor-playwright/issues/9)); CJS only; no typing |
| 8+ other ghost-cursor forks | Playwright, Patchright users | 18 to 896 each | Quick ports | Unmaintained; upstream maintainer called the Playwright port "not really maintained" ([#183](https://github.com/Xetera/ghost-cursor/issues/183)) |
| human-cursor | Playwright users | 675 | Playwright-first API, "momentum" scroll | New (2026-07), no typing |
| playwright-ghost | Playwright users wanting stealth | 781 | Patches Locator/Mouse methods; stealth plugins | No typing or scroll humanizing |
| @playwright-labs/ghost-cursor | `@playwright/test` users | 202 | The only test fixture; ESM | Mouse only |
| CloakBrowser (`humanize=True`) | Scraping, stealth | 97,783 | Mouse, keyboard and scroll humanized together | A patched browser binary, not a library for your own Playwright; 137 open issues |
| Playwright's own `page.screencast.showActions` (1.59 to 1.64) | Anyone recording videos | built in | Animated cursor drawn on recordings, chapters, overlays | A drawing only: the real mouse still teleports, so hover states never fire along the path; typing unchanged |
| Demo recorders (webreel, testreel, playwright-recast) | Demo video makers | 5.7k to 9.5k | Recording, zoom, keystroke HUDs, narration | They make the video; none humanizes the input itself |

## Table stakes

- Curved, timed mouse paths with overshoot. **PRD 01 (shipped in code)**
- Works natively with Playwright, TypeScript types. **PRD 01**
- Scroll targets into view. **PRD 01**
- ESM and CommonJS. **PRD 01**
- A test-runner fixture. **PRD 03**
- Puppeteer support, since the incumbent's users are there. **PRD 06**

## Our wedge

**Every input humanized, reproducibly.** The only Playwright library that does mouse, keyboard and
scroll together, and the only one with seeds. Nobody else can replay a run exactly, and that's
what makes a flaky test reproducible and a demo video re-recordable.

**Playwright draws a cursor. We move the real one.** Playwright 1.64's screencast cursor is a
decoration painted between actions. Our cursor sends real mouse events along the whole path, so
hover menus open, tooltips show and drag and drop works, and our visible cursor (PRD 02) shows
exactly what the page received. It works with any recorder, Playwright's included.

Shown in the first session: run the quickstart and watch it.

## Switching kit

| From | What it takes |
|------|---------------|
| ghost-cursor | Puppeteer adapter so the same `createHuman(page)` works (PRD 06); a call-by-call migration guide (`createCursor` → `createHuman`, `cursor.click` → `human.click`, `moveSpeed` → `speed`); seeds and typing as the reason to move |
| ghost-cursor-playwright and forks | Already Playwright: the migration guide plus "it types and scrolls too" |
| Hand-rolled `keyboard.type({ delay })` loops | One line: `human.type(selector, text)` |
| Playwright screencast cursor | Keep using screencast for recording and chapters; set `showActions({ cursor: 'none' })` and let our cursor drive. Recipe in PRD 02 |

## Openings

- No maintained, trusted Playwright-first option → PRD 01, 05 (CI and releases show it's alive)
- No typing anywhere in the cursor libraries → PRD 01 (shipped in code)
- No determinism → PRD 01 seeds
- Clicks hitting adjacent or covered elements → PRD 01 hit test before pressing
- Slow on remote browsers → PRD 01 player keeps time; PRD 11 pipelines moves so the whole path arrives
- CJS/ESM import errors → PRD 01 dual build, checked by `pnpm smoke`
- Undocumented options and units (ghost-cursor `moveSpeed`) → README tables give units and defaults
- Demo videos where hover states never fire → PRD 02

## Positioning caution

A detection vendor reports catching Bezier-curve cursors 99.6% of the time ([cside, Jul
2026](https://cside.com/blog/catching-playwright-and-browserless-bots-by-the-cursor)). That's
vendor-biased, but it supports the decision not to sell this as a way around bot detection.

## Watching

- ghost-cursor: `scrollTo` accepts element handles (2026-08-04, unreleased; npm still 1.4.2 from 2026-01-12).
- ghost-cursor-playwright: v2.2.0/2.2.1 on 2026-09-15, first release since 2023.
- playwright-ghost: v0.20.0 on 2026-10-25.
- CloakBrowser: v0.7.0 on 2026-11-01.
- Playwright: screencast and `showActions` in 1.59 (2026-04-01); animated pointer in 1.61
  (2026-06-15); cursor persists across navigation, eased path and VP9 video in 1.64 (2026-10-07).
