# PRD 12: Human-looking AI agent recordings

## Goal

Teams recording what their AI browser agents do (Playwright MCP, Stagehand, browser-use) get
videos where the cursor teleports and text appears at once. Offer a recipe, and if it's small
enough a wrapper, that routes an agent's clicks and typing through `createHuman` with the `demo`
preset, so the recording reads like a person using the product. Positioning: recordings and
demos, not evading detection.

## Acceptance criteria (thin)

- A working recipe in `examples/` for at least one agent framework, run in CI with a scripted
  agent step (no model calls).
- A use-case page or README section with a before and after video.
