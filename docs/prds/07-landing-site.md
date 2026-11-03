# PRD 07: Landing site with a live demo

## Goal

A one-page site that sells the library in ten seconds: a "spot the robot" demo where a Playwright
default click (teleport) plays next to a `definitely-not-a-robot` click, using the real planner
running in the browser. Click anywhere to send both cursors. Install command and GitHub link above
the fold.

## Acceptance criteria

- Hero: promise, live demo, install command with copy button, GitHub star link.
- Sections: the pain, use cases, a code sample, FAQ, responsible use, changelog (from
  `CHANGELOG.md`).
- Open Graph image, sitemap, robots, 404. No horizontal overflow from 360 to 1440 px.
- Deployed to Railway; recipe in `docs/DEPLOY.md`.

## Implementation Notes

Shipped 2026-11-03 (PR 8, main 5a0375b). Live at https://site-production-4098.up.railway.app.

- **Stack:** Vite 8 multi-page static site in `site/`: home, `/changelog/` and a 404 page. It's
  served by Caddy from a Docker image on Railway. Pages are plain HTML with `<!--@name-->` markers
  filled at build time:
  - the shared header and footer from `site/partials`;
  - the README's FAQ, responsible-use section and video captions;
  - the examples, highlighted by shiki;
  - the changelog, with a badge for each kind of entry.

  Package URLs come from `package.json`, whose `homepage` is now the site.
- **Demo:** the demo runs the real `createHuman` with the `demo` preset through a stage driver
  (`site/src/demo.ts`). Its mouse events move a drawn cursor, and its targets are the stage's
  buttons, found by the same selectors the code bar shows. Replay creates the human again with
  the same seed and start point; checked headlessly, it lands on the same point every time.
  The button press snaps instead of animating, so a replay measures the button at rest. While it
  animated, a quick replay aimed 1px off.
- **Sizes:** JS shared by every page is 3.7 KB. The demo chunk (the library) is 30 KB, 12.9 KB
  gzipped, and loads only on the home page. CSS is 10.4 KB.
- **Gates:** `pnpm check` now includes `site:build`. `prepublishOnly` runs `check:lib`, so a site
  problem can't block a release.
- **Docker:** packages are fetched from the lockfile alone (`pnpm fetch`), so the install layer
  stays cached until the lockfile changes.
- **Production (deployed 09:45Z):**
  - `/`, `/changelog/`, `/og.png`, `/sitemap.xml` and `/robots.txt` return 200.
  - `/changelog` redirects with a 308, and a made-up path gets the 404 page.
  - Videos answer byte ranges (206) with a one-day cache. Hashed assets are cached for a year.
    Responses are gzipped.
  - Headless at 360–1440 px: no overflow and no failed requests apart from the deliberate 404.
  - The demo tours, takes clicks, cuts one move short with another, and replays to the same
    point.
- **Open:**
  - A custom domain needs the user, because buying one costs money.
  - Videos are served under fixed `/media/` names with a one-day cache (logged in the parking
    lot).
  - The captions in the "What people use it for" section are written for the site, not taken
    from the README.

