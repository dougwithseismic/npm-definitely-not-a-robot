# PRD 08: Use-case recipes and pages

## Goal

Meet each buyer at their pain with a page and a copy-paste recipe:

1. Record product demo videos from Playwright scripts.
2. End-to-end tests that fire real input (debounced search, hover menus, drag and drop).
3. Test your own analytics, heatmaps and bot defences with realistic synthetic sessions.

## Acceptance criteria

- One recipe per use case in `examples/` that runs in CI, and a section or page per use case on the
  site and in the README.

## Implementation Notes

Shipped 2026-11-03 (PR 9, main 1618973). Verified live 10:25Z: the three pages, the sitemap and
both new clips return 200; no horizontal overflow at 360, 390, 768, 1024 or 1440 px; the clip on
each page plays; "More use cases" hides the page you're on.

- **Pages.** `site/use-cases/{demo-videos,real-input-tests,analytics-testing}/index.html`, each with
  a hero clip, three "where plain Playwright falls short" cards, the recipe (highlighted from
  `examples/` at build time via `<!--@example:file-->`) and "More use cases", which reuses the home
  page's cards and hides the current one (`.use:has([aria-current])`). The home page's use-case
  cards link to the pages; the header has a "Use cases" link.
- **Recipes.** Demo videos reuse `examples/record-demo.mjs`. New: `examples/real-input.spec.ts`
  (keyup-driven suggestions plus a signature pad with pointer capture; `page.fill()` and a one-move
  `dragAndDrop` fail both) and `examples/synthetic-sessions.mjs` (three seeded sessions with an
  event counter standing in for analytics). Both run in `pnpm smoke` against the packed tarball,
  under `DNAR_SPEED=instant`; smoke checks each session recorded pointer moves.
- **Clips.** `docs/media/real-input` (6.7 s, 65 KB mp4, 320 KB gif) and `docs/media/analytics`
  (7.7 s, 93 KB mp4, 462 KB gif). The analytics stage counts pointer moves, key presses and clicks
  and draws a small heatmap; plain Playwright sends one pointer move and no key presses.
- **Site build.** Partials resolve by file name (`site/partials/<name>.html`), and the page list
  and sitemap come from every `index.html` under `site/`, so a new page needs no config change.
- **README.** A "Use cases" section before the API, linking the pages and recipes, with the two
  new GIFs.

Open:

- "Bot defences" is covered as "your own bot rules" on the analytics page, inside the
  responsible-use framing; there's no separate page for it.
- Hover menus and drag and drop are named in the real-input copy; the recipe covers
  search-as-you-type and a drawn signature only.
- Each clip's long `aria-label` is written twice (home card and its page). Left as is: a marker for
  one clip costs more than the two copies.
