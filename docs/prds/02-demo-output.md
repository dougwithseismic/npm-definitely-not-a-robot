# PRD 02: Demo-ready output and a video of every feature

## Goal

The wedge. Playwright's video recordings show no cursor and the mouse teleports, so demo videos
made from test scripts look robotic and people re-record them by hand. One option should make a
Playwright run look like a person driving it: a visible cursor, click ripples, smooth paths and
readable typing, all captured by `recordVideo` and screenshots.

```ts
const human = createHuman(page, { preset: 'demo' })
```

The user, 2026-11-03: "It's important to create demo videos of each feature in action too." So
this PRD also builds the recorder that makes those videos with the library itself, and records one
for every feature shipped so far. From here on every user-visible feature ships with its video.

## Locked decisions

- The cursor is drawn from the page's own mouse events, so it shows exactly what the page received.
  That's the difference from Playwright's screencast cursor, which is painted between actions.
- Built with DOM and CSSOM calls only (no `innerHTML`, no `<style>` text), inside a closed shadow
  root on `<html>`, `pointer-events: none`, top z-index. Works under strict CSP because the script
  is injected through the driver (`addScript`), not as an inline tag.
- Survives navigation: re-installed on every new document, and starts where the last page left off
  (`sessionStorage`).
- Videos live in `docs/media/` as MP4 (for the landing site) and GIF (for the README, which can't
  autoplay video). Each GIF at most 12 seconds and 2 MB. They're not in the npm package.

## Acceptance criteria

- WHEN the `visibleCursor()` plugin is on THE page SHALL show a cursor that follows every real
  mouse event, including after navigation, without catching clicks and without page CSS leaking
  into it.
- WHEN the mouse is pressed THE cursor SHALL show a click ripple that is visible in a video frame.
- WHEN `preset: 'demo'` is set THE motion SHALL be smooth (no tremor), typing SHALL be steady and
  readable, and the visible cursor SHALL be on.
- WHEN `trail()` is on THE path SHALL be drawn and fade, for debugging motion.
- WHEN `pnpm demos` runs THE system SHALL record, with the library itself, one short video per
  feature and write an MP4 and a GIF for each to `docs/media/`:
  1. Playwright's own click next to a human click on the same page (the hero comparison)
  2. a click travelling a curve, with overshoot on a long move
  3. a hover menu opening on the way
  4. drag and drop
  5. typing with rhythm, Shift and a corrected typo
  6. wheel-scrolling a target into view
  7. a cookie banner stopping a click, then the click after it's dismissed
  8. the same seed replaying the same run, side by side
- THE README SHALL show the hero comparison on its first screen and each feature's GIF next to
  the feature.
- A recipe and an example script record a real video with `recordVideo`, including pairing with
  Playwright's screencast (`showActions({ cursor: 'none' })`).

## Tasks

1. `src/plugins/visible-cursor.ts`: the in-page cursor and ripple script, installed with
   `driver.addScript`; options `color`, `size`, `ripple`.
2. `src/plugins/trail.ts`: a fading path in the same overlay.
3. `demo` preset in `src/presets.ts`.
4. Integration tests: the overlay follows the mouse, ripples on press, survives navigation, isn't
   hit by clicks.
5. `scripts/demos/`: one small styled page and script per feature, a runner (`pnpm demos`) that
   records with `recordVideo` and converts with ffmpeg (side-by-side clips with `hstack`).
6. `examples/record-demo.mjs` and a README recipe.
7. README: hero GIF and per-feature GIFs.

## Implementation Notes

Shipped 2026-11-03.

**What was built**

- One overlay serves both plugins: `src/plugins/overlay-page.ts` runs in the page and draws the
  cursor, the press ring and the trail. `visibleCursor()` and `trail()` in
  `src/plugins/overlay.ts` validate options and install it through `driver.addScript`. Tasks 1
  and 2 asked for two files; one runtime with two option sets was simpler, and the second plugin
  on a page only updates options.
- The overlay is a `dnar-overlay` element on `<html>` with a closed shadow root, inline
  `!important` styles set through CSSOM, shown as a manual popover so it sits in the top layer, and
  raised again when a dialog or popover opens (`toggle` events). It re-mounts after
  `document.open()` (Playwright's `setContent`) through a MutationObserver, and saves its
  position to `sessionStorage` on `pagehide`.
- Iframes don't draw, and don't build the overlay either. Each frame opens a `MessageChannel` to its parent on its first pointer event
  and sends its moves down that, and the parent adds the frame's offset. The page's own `message`
  handlers see one hello per frame document at most, never the moves. Chromium runs `window`
  listeners in the order they were added whatever the capture flag, so `stopImmediatePropagation`
  alone couldn't hide a relay from a handler added before the overlay.
- Playwright driver: `addScript` adds an init script plus an immediate `evaluate` in every frame
  (errors dropped, since a frame that navigates meanwhile gets the init script), once per page per
  script source (a WeakMap), so a human per step doesn't pile up init scripts.
- `inPage(fn)` (`src/in-page.ts`): esbuild's `keepNames` (used by tsx) wraps inner functions in
  `__name(...)`, which doesn't exist in the page. Every function the driver sends into the page is
  wrapped once at module level. The published build doesn't use keepNames and tsx doesn't
  transform node_modules, so this protects contributors and anyone who bundles the library.
- The trail is drawn in 16 shades of fade, one stroke each, and faded points are dropped from the
  front of the list; at most 5000 points are kept.
- `demo` preset: Fitts a 110 / b 170, curvature 0.2, overshoot 0.15, no tremor, 50 wpm with 0.15
  variance, longer hover and think pauses, and `visibleCursor({ size: 28 })`. A plugin the user
  passes with the same name replaces the preset's (in `createHuman`), so
  `{ preset: 'demo', plugins: [visibleCursor({ color })] }` restyles the cursor instead of adding
  a second one.
- `pnpm demos` (`scripts/demos/`): a shared stage (header label, a code bar showing the running
  line, an optional keycast), eight scenes, recorded with `recordVideo` in Chromium, trimmed by
  timestamps and encoded to MP4 (x264, CRF 23) and a palette GIF that steps down fps and scale
  until it's under 2 MB. Two-sided scenes are joined with `hstack`.
- `examples/record-demo.mjs` with the README recipe; `pnpm smoke` runs it from the packed tarball
  and checks a video over 10 KB was written.

**Numbers**

| Scene | Length | GIF |
| --- | --- | --- |
| hero | 8.6 s | 410 KB |
| curved-paths | 7.0 s | 813 KB |
| hover-menu | 4.1 s | 265 KB |
| drag-and-drop | 3.4 s | 404 KB |
| typing | 10.7 s | 1026 KB |
| scroll-into-view | 5.2 s | 1011 KB |
| cookie-banner | 7.3 s | 455 KB |
| seed-replay | 5.4 s | 594 KB |

All eight are under the 12 s and 2 MB budget; `docs/media` is about 6 MB and not in the package.
Clips run in real time, so a busy machine stretches them: the final take ran at a load average
over 100 and typing first came out at 12.7 s (10.7 s re-taken alone). Record on a quiet machine.
Bundle: ESM 47.94 KB, CJS 48.32 KB. 72 tests (12 for the overlay). CI green on main.

**Open**

- Not checked in Firefox or WebKit: their browsers aren't installed at Playwright 1.64's builds
  here. Re-raising above a modal relies on `<dialog>` toggle events. Belongs with cross-browser
  CI (UX row).
- An iframe inside a shadow root isn't found by the parent, so the cursor stops at its edge; a
  CSS-transformed iframe draws the cursor offset.
- Colours are checked only for being non-empty strings; an invalid one fails silently in the page.
- The restored `sessionStorage` position can be stale until the first move on the new page.
