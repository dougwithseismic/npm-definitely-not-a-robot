# Backlog

`[ ]` not started · `[~]` shipped up to a named seam, or being built · `[x]` complete for users

## Wave 1: v1.0, launch-ready

Lanes: PRD 01 is the contract (driver interface, options, `Human` API) and ships first. After it
merges, 02 + 03 (lane A: `src/plugins/`, `src/presets.ts`, `src/playwright/`), 05 (lane B:
`.github/`, `scripts/`) and 07 (lane C: `site/`) can run side by side. 04 runs last because it
describes everything else.

- [x] 01 Core engine and factory: `createHuman`, Playwright driver, motion, typing, scroll, presets, seeds (`docs/prds/01-core-engine.md`) (shipped 2026-11-03)
- [x] 02 Demo-ready output: visible cursor, click ripples, `demo` preset, a video of every feature (`docs/prds/02-demo-output.md`) (shipped 2026-11-03)
- [~] 03 Playwright Test fixture: `human` fixture from `definitely-not-a-robot/playwright` (`docs/prds/03-test-fixture.md`) (shipped 2026-11-03)
- [x] 04 A README that sells: hero, demo video, 60-second quickstart, recipes, glossary (`docs/prds/04-readme.md`) (shipped 2026-11-03, PR 12; `funding` moves to the sponsorship item below)
- [~] 05 CI and release: GitHub Actions checks, pack smoke test, tagged releases with npm provenance (`docs/prds/05-ci-release.md`) (CI checks, smoke test and tag-based release workflow shipped 2026-11-03; provenance starts once npm trusts the workflow)
- [~] 06 Puppeteer adapter and ghost-cursor migration guide (`docs/prds/06-puppeteer-switching.md`) (driver shipped 2026-11-03: `createHuman` works on Puppeteer pages, PR 10; the migration guide waits on naming competitors)
- [x] 07 Landing site with a live "spot the robot" demo, on Railway (`docs/prds/07-landing-site.md`) (shipped 2026-11-03: https://site-production-4098.up.railway.app)
- [x] 08 Use-case recipes: demo videos, realistic E2E, testing your own bot defences (`docs/prds/08-use-cases.md`) (shipped 2026-11-03: https://site-production-4098.up.railway.app/#uses)

## Launch bar

Adapted for an open-source developer library. Not applicable: accounts, email, payments checkout,
database backups (no server-side product). "Can pay" means sponsorship.

- [x] The core job works for a stranger: the packed tarball installs into an empty folder and the
      README quickstart runs first time against a real page (`pnpm smoke`)
- [x] First value in under two minutes: install plus a quickstart of ten lines or fewer
- [x] Errors say what happened and what to do (target not found, not visible, wrong page type)
- [x] README first screen says who it's for, the outcome and why this over the alternatives, with
      one call to action (install)
- [x] A demo video of every feature in action, made with the library itself
- [x] Typed, ESM and CommonJS, Node 18+, works with `playwright` and `@playwright/test`
- [x] Tests and CI green, with a badge
- [ ] Versioned changelog and GitHub releases
- [x] LICENSE, SECURITY.md, CONTRIBUTING.md, issue templates
- [x] Responsible-use statement: what it is for and what it doesn't do
- [ ] Published to npm with provenance **(you: type npm's one-time code for the first publish)**
- [ ] Sponsorship link that works, also as `funding` in package.json **(you: enable GitHub
      Sponsors, or name another link)**
- [x] Landing site live with the live demo, Open Graph image, sitemap, 404
- [x] Use-case pages from `docs/MARKET.md`
- [x] Public changelog page fed from `CHANGELOG.md`
- [x] Measurement: npm weekly downloads and GitHub stars recorded in `docs/LAUNCH.md` each wave

## Needs you

- **The first publish.** Logged in and approved ("letse publish when ready"). npm asks for your
  one-time code, so `npm publish` runs in a terminal where you can type it. npm only lets a
  workflow publish (with provenance) once the package exists, so 1.0.0 goes from your machine and
  later versions from the release workflow.
- **OK to name competitors?** The migration guide (PRD 06) and any comparison page name
  ghost-cursor and Playwright's screencast cursor. Say which names are fine to use in public copy.

## UX

- [x] Targets inside scrolling panels and iframes are brought into view with an instant
      `scrollIntoViewIfNeeded`. A person would move over the panel and turn the wheel; do that
      (needs the clipping box from the driver, see PRD 01 notes).
      (shipped 2026-11-03, PR 15)
- [x] Use-case and gallery cards are blank until their video loads (`preload="none"`), which shows
      on slow connections and in full-page screenshots. Give each video a poster frame.
      (shipped 2026-11-03, PR 14)
- [x] Typing into an email or number field that already has text lands where the click did,
      because those inputs don't allow moving the caret. Select the text and press the right
      arrow, which leaves the caret at the end on every platform. (fixed 2026-11-03, PR 13)
- [ ] Check the visible cursor in Firefox and WebKit (raising above a modal relies on `<dialog>`
      toggle events), and run the integration tests there in CI.
- [~] The visible cursor stops at the edge of an iframe inside a shadow root, and is offset over a
      CSS-transformed iframe. (building since 2026-11-03, autopilot session)
- [x] `visibleCursor({ color: 'blu' })` is accepted and draws nothing; check colours when the
      plugin is created. (fixed 2026-11-03, PR 13)

## Parking lot

- The site's demo videos are served under fixed `/media/` names with a one-day cache. Hashed names
  (through Vite's asset handling) would let them cache for good and refresh when re-recorded.
- WindMouse motion strategy as an alternative to Bezier curves
- Trackpad scrolling persona (momentum) next to mouse-wheel notches
- Touch input: tap, swipe, pinch for mobile emulation
- Record your own mouse in the browser and turn it into a persona ("move like me")
- Drivers for WebdriverIO and Selenium
- AI browser agents: a wrapper for Playwright MCP / Stagehand so agent runs look human in recordings
- Python port
- Comparison pages (`/vs/ghost-cursor`) once we're better on what they compare, after the user OKs naming them
