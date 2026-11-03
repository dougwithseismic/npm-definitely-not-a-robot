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

Driver part shipped 2026-11-03 (PR 10, main d395dce; CI fix PR 11, 18b3f51). Verified live 11:03Z:
the home page's Puppeteer tab shows the example, the FAQ says yes, the changelog has the entry,
`/media/puppeteer.mp4` returns 200, and the clip spans the gallery row at 1440 px with no overflow. The migration guide is open: it names
ghost-cursor, and naming competitors in public copy waits on the user's OK.

- **Driver.** `src/drivers/puppeteer.ts`, picked by `createHuman` when the page has Puppeteer's
  shape (`$`, `viewport`, `evaluateOnNewDocument`, `keyboard.sendCharacter`). Typed by shape like
  the Playwright driver, so `puppeteer`, `puppeteer-core` and tools built on them need no import.
  Targets: CSS and Puppeteer selectors (`::-p-text(...)`, looked up again on every use), element
  handles (visibility polled every 100 ms; a handle whose element left the page reports
  TARGET_NOT_FOUND), points. `page.locator()` locators aren't supported.
- **Gaps the driver fills.** Puppeteer doesn't know `ControlOrMeta` (mapped to Meta or Control from
  `navigator.platform`, asked once per page and again if the page was navigating). On a Mac,
  Chromium runs editing shortcuts from synthetic keys only when sent the command with the key;
  Playwright does this and Puppeteer doesn't, so Meta+A/C/V/X/Z and Shift+Meta+Z carry
  `selectAll`, `copy`, `paste`, `cut`, `undo`, `redo` (Playwright's own table). Verified: Meta+A
  without the command left the caret at 9,9; with it, 0,9. Mouse down/up pass `clickCount`, which
  Puppeteer accepts though its types omit it.
- **Shared.** In-page helpers (`hitTest`, `caretToEnd`, `windowSize`, `scrollOffset`),
  `addScriptOnce` and `isTimeout` moved to `src/drivers/common.ts`. The `Driver.keyDown` doc now
  says key names follow Playwright's, including `ControlOrMeta`, which a driver must resolve.
- **Tests.** `test/integration/drivers.test.ts` runs 11 checks on both drivers, plus Puppeteer's
  own selectors; puppeteer-core drives Playwright's Chromium, so no second browser download.
  `pnpm smoke` installs `puppeteer` next to the packed tarball (`PUPPETEER_SKIP_DOWNLOAD=1`), runs
  the README example unchanged but headless on Playwright's Chromium (`PUPPETEER_EXECUTABLE_PATH`),
  and type-checks a real Puppeteer `Page`. CI and the release workflow turn off Ubuntu's AppArmor
  block on user namespaces (PR 11): Puppeteer keeps Chrome's sandbox on, which those runners
  otherwise refuse ("No usable sandbox!"); Playwright turns the sandbox off, so it never hit this.
- **Clip.** `docs/media/puppeteer` (9.0 s, 89 KB mp4, 449 KB gif): the same sign-up on a page from
  Playwright and a page from Puppeteer. The recorder connects Puppeteer to Playwright's browser
  over CDP on a free port so Playwright can film the tab Puppeteer drives.
- **Docs.** README "With Puppeteer" section and FAQ, the site's Puppeteer code tab, the clip in
  "See it" (spans the row on the site, as the odd one out).

Open:

- `docs/migrate-from-ghost-cursor.md` (needs the OK to name competitors).
- Puppeteer locators (`page.locator()`) aren't supported. Firefox through Puppeteer's WebDriver
  BiDi is untested.
