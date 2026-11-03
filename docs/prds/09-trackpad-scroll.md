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
