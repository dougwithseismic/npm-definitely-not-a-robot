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
