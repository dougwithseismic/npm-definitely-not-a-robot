# Backlog

`[ ]` not started · `[~]` shipped up to a named seam, or being built · `[x]` complete for users

## Wave 1: v1.0, launch-ready

Lanes: PRD 01 is the contract (driver interface, options, `Human` API) and ships first. After it
merges, 02 + 03 (lane A: `src/plugins/`, `src/presets.ts`, `src/playwright/`), 05 (lane B:
`.github/`, `scripts/`) and 07 (lane C: `site/`) can run side by side. 04 runs last because it
describes everything else.

- [x] 01 Core engine and factory: `createHuman`, Playwright driver, motion, typing, scroll, presets, seeds (`docs/prds/01-core-engine.md`) (shipped 2026-11-03)
- [~] 02 Demo-ready output: visible cursor, click ripples, `demo` preset, a video of every feature (`docs/prds/02-demo-output.md`) (building since 2026-11-03, autopilot session)
- [ ] 03 Playwright Test fixture: `human` fixture from `definitely-not-a-robot/playwright` (`docs/prds/03-test-fixture.md`)
- [ ] 04 A README that sells: hero, demo video, 60-second quickstart, recipes, glossary (`docs/prds/04-readme.md`)
- [~] 05 CI and release: GitHub Actions checks, pack smoke test, tagged releases with npm provenance (`docs/prds/05-ci-release.md`) (CI checks and smoke test shipped 2026-11-03; tagged releases and provenance open)
- [ ] 06 Puppeteer adapter and ghost-cursor migration guide (`docs/prds/06-puppeteer-switching.md`)
- [ ] 07 Landing site with a live "spot the robot" demo, on Railway (`docs/prds/07-landing-site.md`)
- [ ] 08 Use-case recipes: demo videos, realistic E2E, testing your own bot defences (`docs/prds/08-use-cases.md`)

## Launch bar

Adapted for an open-source developer library. Not applicable: accounts, email, payments checkout,
database backups (no server-side product). "Can pay" means sponsorship.

- [x] The core job works for a stranger: the packed tarball installs into an empty folder and the
      README quickstart runs first time against a real page (`pnpm smoke`)
- [x] First value in under two minutes: install plus a quickstart of ten lines or fewer
- [x] Errors say what happened and what to do (target not found, not visible, wrong page type)
- [ ] README first screen says who it's for, the outcome and why this over the alternatives, with
      one call to action (install)
- [ ] A demo video of every feature in action, made with the library itself
- [x] Typed, ESM and CommonJS, Node 18+, works with `playwright` and `@playwright/test`
- [ ] Tests and CI green, with a badge
- [ ] Versioned changelog and GitHub releases
- [x] LICENSE, SECURITY.md, CONTRIBUTING.md, issue templates
- [x] Responsible-use statement: what it is for and what it doesn't do
- [ ] Published to npm with provenance **(you: npm login, then say publish)**
- [ ] Sponsorship link that works **(you: enable GitHub Sponsors, or name another link)**
- [ ] Landing site live with the live demo, Open Graph image, sitemap, 404
- [ ] Use-case pages from `docs/MARKET.md`
- [ ] Public changelog page fed from `CHANGELOG.md`
- [ ] Measurement: npm weekly downloads and GitHub stars recorded in `docs/LAUNCH.md` each wave

## Needs you

- **npm login and first publish.** Run `npm login` in a terminal, then tell me "publish". Unblocks
  the launch bar's npm item and the install instructions everyone else will copy.
- **OK to name competitors?** The migration guide (PRD 06) and any comparison page name
  ghost-cursor and Playwright's screencast cursor. Say which names are fine to use in public copy.

## UX

- [ ] Targets inside scrolling panels and iframes are brought into view with an instant
      `scrollIntoViewIfNeeded`. A person would move over the panel and turn the wheel; do that
      (needs the clipping box from the driver, see PRD 01 notes).
- [ ] Typing into an email or number field that already has text lands where the click did,
      because those inputs don't allow moving the caret. Press End (or Cmd+Right on macOS) instead.

## Parking lot

- WindMouse motion strategy as an alternative to Bezier curves
- Trackpad scrolling persona (momentum) next to mouse-wheel notches
- Touch input: tap, swipe, pinch for mobile emulation
- Record your own mouse in the browser and turn it into a persona ("move like me")
- Drivers for WebdriverIO and Selenium
- AI browser agents: a wrapper for Playwright MCP / Stagehand so agent runs look human in recordings
- Python port
- Comparison pages (`/vs/ghost-cursor`) once we're better on what they compare, after the user OKs naming them
