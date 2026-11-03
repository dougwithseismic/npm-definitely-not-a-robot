# Changelog

What's new, newest first. Each entry says what you can do now.

## 2026-11-03 · v1.0.0 (not yet on npm)

### Rebuilt from scratch for Playwright (PRD 01) · New
- Wrap any Playwright page with `createHuman(page)` and click, hover, drag, type, press keys and
  scroll like a person. No browser launching, no setup: bring the page you already have.
- Mouse paths arc and are timed by how far and how small the target is. Long moves sometimes
  overshoot and correct.
- Typing has a real rhythm, holds Shift for capitals, handles emoji and accents, and can make
  typos that it fixes, so the field always ends up with exactly your text.
- Off-screen targets are scrolled into view with the mouse wheel before the cursor heads for them.
- Clicks won't go through a banner or modal covering the target. The error names what's in the way.
- Works inside iframes and scrolling panels: a target hidden inside one is scrolled into place
  before the click, and `scroll({ to: 'bottom' })` scrolls an app's main panel, not just the page.
- Typing into a field that already has text adds to the end; `{ clear: true }` replaces it.
- Errors say what actually went wrong: a locator that matches several elements, a broken
  selector, or an option that doesn't make sense, each with what to do next.
- `seed` replays a run exactly; `DNAR_SPEED=instant` runs the same script at full speed in CI.
- Presets (`average`, `careful`, `fast`), and your own motion, typing, scroll, plugins and drivers.
- Works with `playwright`, `playwright-core` and `@playwright/test`. TypeScript types, ESM and
  CommonJS, no dependencies.
- Try it: the Quickstart in the README.

### Fixed
- Importing the package no longer opens a browser.
- Two humans on the same page no longer share one cursor.
- The package installs and runs without pulling in Puppeteer.

## 2023-08-02 · v0.0.2

### Human-like mouse movement to elements · New
- `humanMove()` moved the mouse along a curved path to an element and clicked it (Puppeteer).
