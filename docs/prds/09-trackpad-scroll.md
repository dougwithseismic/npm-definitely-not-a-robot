# PRD 09: Trackpad scrolling

## Goal

Scrolling that looks like a laptop trackpad: many small deltas that speed up, glide and slow
down, instead of 100 px wheel notches. Demo videos (use case 1) look smoother, and synthetic
sessions (use case 3) can mix wheel and trackpad users. No alternative offers both kinds.

## Locked decisions

- A new strategy, `trackpadScroll(options)`, next to `wheelScroll()`, exported and documented.
  `scroll: { kind: ... }` isn't added; strategies stay functions.
- The `demo` preset switches to trackpad scrolling, since it exists for videos. `average`,
  `careful` and `fast` keep the wheel.
- Same seed, same deltas. Instant mode still merges steps into a few events.

## Acceptance criteria

- WHEN `scroll: trackpadScroll()` scrolls 1,000 px THEN the page SHALL receive at least 20 wheel
  events, each under 60 px, landing exactly on the distance, with a speed that rises then falls.
- WHEN the distance is long THEN it SHALL be split into several flicks with pauses between.
- WHEN options are out of range THEN `createHuman` SHALL throw a `HumanError` naming the option.
- The README and site show a demo video: wheel notches next to trackpad glide.

## Implementation Notes

Shipped 2026-11-03 (PR 19).

- `trackpadScroll({ flick })` in `src/scroll/index.ts`, exported with `TrackpadScrollOptions`. A
  distance becomes `ceil(distance / flick)` flicks of about equal size (±10%). Each flick is a
  speed curve: a sine rise over 3 to 6 frames, then a glide that loses 8 to 12% a frame until it's
  under 5% of the peak. Frames are 14 to 19 ms apart; the fingers come back after 100 to 250 ms.
  Steps round the running total per axis, so they land exactly; frames that round to nothing send
  no event and their time passes before the next one.
- Default flicks are 300 to 700 px (250 to 500 made a 1,400 px scroll take 4 s). At 1,000 px no
  step reached 60 px in 3,000 seeds; longer distances reach about 75 px. A 1,400 px scroll takes about 2 to 3 s
  against the wheel's 1.3 s, in 100 to 200 events.
- Real-time wheel playback now keeps to the plan's clock like mouse paths: a step that's late
  joins the next one instead of being waited for. Before, each event's round trip added to its
  gap, which doubled a trackpad scroll's time. Instant mode is unchanged (8 events).
- The `demo` preset uses `trackpadScroll()`. Passing wheel options (`scroll: { notch }`) with it
  switches back to the wheel; to tune the trackpad pass `trackpadScroll({ flick })`.
- Demo video `trackpad-scroll` (wheel and trackpad side by side); `scroll-into-view` and
  `scroll-panel` re-recorded with the demo preset's trackpad. The key strip in demo videos shows
  one chip per burst or flick with its distance, instead of one per event.
- Mouse paths and wheel steps share one clock (`startClock` in `src/human.ts`). Same seed,
  same plan; what reaches a slow browser can differ, as with paths.
- `scroll: { flick }` (wheel options carrying a trackpad option) throws and points to
  `trackpadScroll()`. `flick: [min, Infinity]` is rejected.
- Verified live 2026-11-03 12:59Z: gallery row, changelog entry and the demo-videos card on the
  site; `trackpad-scroll.mp4` 146 KB.
- Open: WebKit on CI answered each wheel event in about half a second, so a 600 px glide reached
  the page as 3 events (PRD 11). The glide test skips WebKit; the slow-browser test runs there.
- Not on npm until the version after 1.0.0 (needs trusted publishing or another manual publish).
