# Changelog

What's new, newest first. Each entry says what you can do now.

## 2026-11-03

### Scrolling lists, panels and iframes turn with the wheel · Improved
- When a target is hidden inside something that scrolls on its own (an inbox list, a chat, an
  app's main area or an iframe), the cursor now moves over it and turns the wheel until the target
  shows, as a person would. It used to jump the panel there in one go, so the page saw a scroll
  with no wheel and no mouse over the panel.
- Panels that don't scroll with the wheel still get there, as before.
- Try it: the scrolling-list clip in the README's "See it" section, or "See every feature" on the website.

### Videos on the website show a picture before they play · Improved
- Every video on the website now shows its first frame straight away, on slow connections, with
  reduced motion on, and in full-page screenshots. Before, each card was a blank box until its
  video loaded.
- Try it: "See every feature" and the three use-case pages on the website.

### Typing adds to the end of email and number fields · Fixed
- `human.type('#email', '.org')` on an email or number field that already has text now adds it at
  the end. Those fields don't let scripts move the caret, so the text used to land wherever the
  click did. Now it presses the right arrow key to reach the end first, on every platform, with
  Playwright and Puppeteer. An empty field gets no extra key press.

### A misspelled cursor colour is caught straight away · Fixed
- `visibleCursor({ color: 'blu' })` and `trail({ color: 'blu' })` now throw when you create them,
  saying what they got and what a colour looks like. Before, the browser ignored the colour and the
  cursor was drawn in nothing.

### A README that says who it's for and why (PRD 04) · Improved
- The top of the README now says who the library is for and what sets it apart: every input
  humanized, not just the cursor; the real mouse moved, so hover menus open on the way; and any
  run replayed exactly from its seed.
- A new Presets section compares `average`, `careful`, `fast` and `demo`, and shows how to adjust
  one or make your own with `definePreset()`.
- A new recipe wraps the built-in driver to change how input reaches the browser.
- The FAQ explains why a cursor drawn on by a recorder isn't the same as moving the real mouse.
- Try it: the README on GitHub or npm, or the FAQ on the website.

### Works with Puppeteer (PRD 06) · New
- Pass a Puppeteer page to `createHuman` and every action works as it does on Playwright:
  clicks, drags, typing, key presses, scrolling and the visible cursor. There's nothing to set up;
  the library sees which tool you're using.
- Targets are CSS selectors, Puppeteer's own selectors such as `::-p-text(Sign up)`, element
  handles from `page.$()`, or points. The same seed draws the same path in either tool.
- Try it: the "With Puppeteer" section of the README, or the Puppeteer tab on the website.

### Recipes and pages for three use cases (PRD 08) · New
- Demo videos, tests that need real input, and checking your own analytics: each now has a page
  on the website with a video, what plain Playwright misses, and a recipe you can copy.
- New recipes: `examples/real-input.spec.ts` tests a search box that suggests on each key and a
  signature pad that wants a real stroke, and `examples/synthetic-sessions.mjs` runs seeded
  sessions and prints what each one sent. Both run in CI against the package as npm installs it.
- Try it: https://site-production-4098.up.railway.app/#uses

### A website with a live demo (PRD 07) · New
- See Playwright's click next to a human one: click anywhere on the demo and both cursors go
  there, one in a single jump, the other along a curved path. The second cursor is the library
  itself running in your browser, with the `demo` preset. Replay the seed to watch the identical
  path again.
- Every feature video, the quickstart, the FAQ and this changelog, on one page.
- Try it: https://site-production-4098.up.railway.app

## 2026-11-03 · v1.0.0

### On npm · New
- `npm install definitely-not-a-robot`. Versions after 1.0.0 are published by this repo's GitHub
  Actions with npm provenance, so npm shows which commit and build each one came from.
- Each release gets a GitHub release with its notes from this changelog.

### A `human` in every Playwright Test (PRD 03) · New
- `import { test, expect } from 'definitely-not-a-robot/playwright'` and every test gets a `human`
  next to `page`, driving that test's page. Nothing else in your tests changes.
- `test.use({ humanOptions: { preset: 'demo' } })` sets options for a file, and
  `use: { humanOptions }` in `playwright.config.ts` sets them for every test. Add `video: 'on'`
  and every test records a demo video with the cursor in it.
- Already have your own `test`? Playwright's `mergeTests(yourTest, test)` combines them.
- CI keeps human timing until you set `DNAR_SPEED=instant`, so videos recorded there still look
  like a person.
- `@playwright/test` stays optional: the main package never loads it.
- Try it: "In Playwright Test" in the README.

### Demo videos that show the cursor (PRD 02) · New
- `createHuman(page, { preset: 'demo' })` draws a cursor, with a ring on every click, into
  screenshots and `recordVideo` recordings. Headless browsers draw no cursor of their own, so
  videos made from scripts used to show buttons pressing themselves.
- The cursor follows the page's real mouse events, Playwright's own clicks included, so it shows
  exactly what the page received. It keeps going across page loads, iframes and dialogs, works on
  pages with a strict Content Security Policy, and never gets in the way of a click.
- The demo preset moves smoothly and types at a steady, readable pace.
- `visibleCursor()` adds the cursor to any preset, or restyles the demo one, in your colour and
  size. `trail()` draws the path the mouse took, for seeing exactly how it moved.
- Try it: "Record a demo video" in the README. Every clip in the README's "See it" section was
  recorded this way.

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
- `speed: 'instant'` is now fast for mouse moves and scrolling too. A long move used to take as long
  as a person would; now it takes about a tenth of a second. Drags still send every point of the
  path, because pages read each move while the button is held.
- Importing the package no longer opens a browser.
- Two humans on the same page no longer share one cursor.
- The package installs and runs without pulling in Puppeteer.

## 2023-08-02 · v0.0.2

### Human-like mouse movement to elements · New
- `humanMove()` moved the mouse along a curved path to an element and clicked it (Puppeteer).
