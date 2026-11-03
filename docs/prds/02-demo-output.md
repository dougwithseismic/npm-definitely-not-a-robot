# PRD 02: Demo-ready output

## Goal

The wedge. Playwright's video recordings show no cursor and the mouse teleports, so demo videos
made from test scripts look robotic and people re-record them by hand. One option should make a
Playwright run look like a person driving it: a visible cursor, click ripples, smooth paths and
readable typing, all captured by `recordVideo` and screenshots.

```ts
const human = createHuman(page, { preset: 'demo' })
```

## Acceptance criteria

- WHEN the `visibleCursor()` plugin is on THE page SHALL show a cursor that follows every real
  mouse event, including after navigation, without catching clicks (pointer-events: none) and
  without page CSS leaking into it (shadow DOM).
- WHEN the mouse is pressed THE cursor SHALL show a click ripple that is visible in a video frame.
- WHEN `preset: 'demo'` is set THE motion SHALL be smooth (no tremor), typing SHALL be steady and
  readable, and the visible cursor SHALL be on.
- WHEN `trail()` is on THE path SHALL be drawn and fade, for debugging motion.
- A recipe and an example script record a real video with `recordVideo`.

## Tasks

`src/plugins/visible-cursor.ts`, `src/plugins/trail.ts`, `demo` preset, example in
`examples/record-demo.ts`, integration test checking the overlay moves with the mouse.

## Implementation Notes
