# PRD 06: Puppeteer adapter and ghost-cursor migration

## Goal

ghost-cursor is the incumbent and it's Puppeteer-first. Lower the cost of switching: the same
`createHuman(page)` works on a Puppeteer page, and a migration guide maps ghost-cursor calls to ours.

## Acceptance criteria

- WHEN `createHuman` is given a Puppeteer page THE system SHALL pick the Puppeteer driver
  automatically and every action SHALL work as it does on Playwright.
- Integration tests run the same suite against Puppeteer (using Playwright's Chromium).
- `docs/migrate-from-ghost-cursor.md`: call-by-call mapping, option mapping, what's different.

## Implementation Notes
