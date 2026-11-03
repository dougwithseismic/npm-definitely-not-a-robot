# PRD 10: Touch input

## Goal

Humanized taps and swipes for mobile emulation (`hasTouch` contexts): a tap lands with a little
scatter and a real press time; a swipe follows a curved, decelerating finger path. Mobile demo
videos and touch-only UI (carousels, pull to refresh, bottom sheets) can then be recorded and
tested the way people use them.

## Acceptance criteria (thin)

- `human.tap(target)` and `human.swipe(from, to | { direction, distance })`, through the driver
  interface (Playwright touchscreen / CDP touch events; Puppeteer `page.touchscreen`).
- The visible cursor shows a finger marker instead of the arrow on touch pages.
- A demo video of a carousel swiped by hand.
