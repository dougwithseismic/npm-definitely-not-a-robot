# PRD 11: Every point reaches slow browsers

## Goal

Playback waits for each mouse move to come back before sending the next, and drops points to
stay on time. Where a round trip is slow (WebKit on CI answers in tens of milliseconds; remote
browsers over a network take longer) most of the path never reaches the page: 3 moves on a path
Chromium receives 15+ of. Send each move at its time without waiting for the one before, keep
them in order, and wait for all of them before pressing.

## Acceptance criteria (thin)

- WHEN a path plays in WebKit THEN the page SHALL receive at least 80% of the planned points
  (CI checks it; the Firefox/WebKit job already exists).
- Timing stays on the plan's clock in Chromium; a press never overtakes the moves before it.
- The changelog's WebKit caveat (2026-11-03) is removed once it holds.

## Implementation Notes (2026-11-03, PR 20)

- `Driver.maxInFlight` (optional, default 1; the Playwright and Puppeteer drivers set 8). Both
  libraries put input on the wire in call order, so moves needn't wait for each other's answers.
  `createHuman` rejects anything that isn't a whole number ≥ 1.
- `sender()` in `src/human.ts`: `send(start)` waits only when `maxInFlight` are unanswered, and
  remembers the first failure; `drain()` waits for the rest and throws it. `playPath` and
  `playWheel` drain before returning, so a press never overtakes the moves before it. The clock
  still skips points, now only when the browser is eight behind.
- Instant mode sends one at a time: pipelined, Chromium coalesced the moves and wheel events
  (7 tests failed: drags, seed replay, instant wheel counts).
- WebKit on CI: the new check (≥ 4 in 5 planned points reach the page, with 0 and 40 ms added
  lag) passes. The WebKit allowances on paths are gone: the curve check and path counts (> 10,
  > 3) run in WebKit too. The trackpad glide count still skips WebKit: there it got 5 wheel
  events one run and more than 8 the next. WebKit on CI takes wheel events one at a time, about
  0.5 s each, so pipelining can't help; steps merge and the whole distance still scrolls. The first test in each file used to take ~5 s in
  WebKit (486 ms in Chromium) and got 5 points: a fresh WebKit takes its first input slowly, so
  `launch()` in the fixture warms each browser up with one page and 20 moves.
- Demo `slow-browser`: a driver wrapper adds 80 ms to every move; waiting for each answer, 32
  moves reached the page, sent ahead, 112. Scenes can now wrap the driver (`Side.wrapDriver`).
- Open: nothing for this PRD. Custom drivers stay at 1 unless they opt in.
