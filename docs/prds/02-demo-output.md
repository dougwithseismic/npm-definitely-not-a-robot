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
