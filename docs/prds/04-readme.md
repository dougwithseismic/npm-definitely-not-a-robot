# PRD 04: A README that sells

## Goal

The README is the landing page for most developers (npm and GitHub). Its first screen answers who
it's for, what they get, and why this over ghost-cursor and friends, with one call to action.

## Acceptance criteria

- First screen: one-line promise, a demo GIF/video recorded with the library, install command,
  a quickstart of ten lines or fewer that runs when pasted.
- Sections: why (the pain), use cases, API reference table, presets, recipes (demo video, CI speed,
  seeds, custom motion, custom driver, plugins), FAQ (does it beat bot detection? no, and why),
  responsible use, glossary link, changelog link.
- npm metadata: description, keywords chosen for npm search, homepage, repository, funding.
- LICENSE, CONTRIBUTING.md, SECURITY.md, issue templates.

## Implementation Notes

Shipped 2026-11-03 (PR 12, main 4ae82a8). Most of the README already existed from PRDs 01 to 08;
this round closed the gaps against the criteria.

- First screen: the promise, then who it's for (the three jobs from `docs/MARKET.md`), the hero
  GIF, three "why this one" bullets drawn from the wedge (every input humanized; the real mouse
  moved, not a drawn cursor; runs replayed from a seed), then install as the one call to action,
  then badges. At 1280x800 all of it fits above the Quickstart heading. The live demo link moved
  under the quickstart so install is the only call to action up top.
- No competitor is named. "Why this one" and the new FAQ answer ("My recorder already draws a
  cursor") make the comparison without names, until the user OKs naming them.
- New Presets section (table of the four presets from `src/presets.ts`, overriding one part, and
  `definePreset()`), and a custom-driver recipe that spreads `playwrightDriver(page)` and wraps
  `mouseDown`. Both snippets were type-checked against `src` before merging.
- Glossary pointer in the API section and a new **Target** entry in `docs/GLOSSARY.md`.
- npm: description mentions Puppeteer and seeds; keywords now 19 (added puppeteer,
  playwright-test, human-like, keyboard, scroll, fitts-law, screen-recording). GitHub repo
  description now mentions Puppeteer, the homepage points at the site, and topics gained puppeteer,
  human-like and playwright-test.
- Site: the hero eyebrow and lead mention Puppeteer; the FAQ (read from the README) has the new
  answers.

Open: `funding` waits on a sponsorship link (launch bar item, needs the user). The npm badge reads
"not found" until 1.0.0 is published.
