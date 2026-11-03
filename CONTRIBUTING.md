# Contributing

Thanks for helping. Bug reports with a reproduction are the most useful thing you can send.

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

## Before you open a pull request

```bash
pnpm check   # types, lint, unit and browser tests, build, website build
pnpm smoke   # packs the library, installs it into an empty folder, runs the README quickstart
```

## How the code is laid out

- `src/human.ts` is the factory (`createHuman`) and the player that sends planned steps to the
  browser.
- `src/motion`, `src/typing` and `src/scroll` are pure planners. They return timed steps and never
  touch a browser, so they're tested without one.
- `src/drivers` adapts Playwright (and later others) to the small `Driver` interface.
- `docs/GLOSSARY.md` explains the terms (factory, adapter, strategy, Fitts's law, seeds…).

## Reproducing a bug

Every human has a seed. Log `human.seed`, then pass `{ seed }` to replay the exact same paths and
timings. Include the seed in your issue if the bug depends on movement.

## Style

Biome formats and lints (`pnpm format`). Write comments that explain why, and changelog entries
for users: what they can do now, not what files changed.
