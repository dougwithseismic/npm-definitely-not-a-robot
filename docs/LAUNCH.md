# Launch

Written 2026-11-03, when the launch bar was done apart from the items only you can do.

## What's live

- Website with the live demo: https://site-production-4098.up.railway.app
- Use-case pages: [demo videos](https://site-production-4098.up.railway.app/use-cases/demo-videos/),
  [tests that need real input](https://site-production-4098.up.railway.app/use-cases/real-input-tests/),
  [checking your own analytics](https://site-production-4098.up.railway.app/use-cases/analytics-testing/)
- Public changelog: https://site-production-4098.up.railway.app/changelog/
- Repo, README with a video of every feature, CI badge:
  https://github.com/dougwithseismic/npm-definitely-not-a-robot
- npm: not yet. 1.0.0 is built, tested and waiting for your one-time code (step 1 below).

## Positioning

Your Playwright scripts click like robots; this makes them move like people, for product demos
recorded from scripts, tests of UI that only reacts to real input, and checking your own
analytics. It humanizes mouse, keyboard and wheel together, moves the real mouse rather than
drawing one, and replays any run exactly from a seed.

## Pricing

Free and MIT. Money comes from sponsorship once there's a link (step 3).

## What only you can do, in order

1. **Publish 1.0.0.** Say "publish" in the session: it opens a terminal on a clean copy of `main`
   and runs `npm publish --access public`, and you type npm's one-time code when asked. Then it
   pushes the tag (`git tag v1.0.0 && git push origin v1.0.0`), and the release workflow sees 1.0.0
   is already on npm and creates the GitHub release from the changelog.
   Unblocks: the npm badge, "Versioned changelog and GitHub releases", download numbers.
2. **Let the release workflow publish later versions.** After step 1, run
   `npx npm@latest trust github definitely-not-a-robot --file release.yml --repo dougwithseismic/npm-definitely-not-a-robot --allow-publish`
   and type the one-time code. From then on, pushing a `v*` tag publishes with npm provenance.
3. **A sponsorship link.** Turn on GitHub Sponsors (https://github.com/sponsors/accounts), or name
   another link (Ko-fi, Open Collective, Polar). The session then adds `funding` to package.json
   and a sponsor button to the repo and the site.
4. **Naming the alternatives.** Say which names are fine in public copy (ghost-cursor and its
   forks, Playwright's screencast cursor). Unblocks the call-by-call migration guide and
   comparison pages, the strongest way to win people who already use one.
5. **Optional: a domain.** The site runs on a railway.app address. A domain costs money, so it's
   your call; pointing one at Railway takes a few minutes once bought.

## Launch-day checklist

Post after step 1, so every link installs. Lead with the hero GIF or the live demo, and the
sentence "Your Playwright scripts click like robots."

- Show HN: "Show HN: Make Playwright scripts move like people (curved mouse, real typing, seeds)",
  linking the repo. Stay around for the first two hours of comments.
- Reddit: r/Playwright, r/QualityAssurance, r/webdev, r/javascript. Use the demo GIF; one post per
  community, tailored to its job (tests in r/QualityAssurance, demos in r/webdev).
- The Playwright community Discord and the Playwright GitHub Discussions "Show and tell".
- X, Bluesky and LinkedIn: the side-by-side hero clip, with the npm install line.
- A dev.to or Hashnode post built from the demo-videos use-case page: "Record product demos from
  Playwright scripts that look real".
- Product Hunt is optional; developer tools do better on HN and Reddit.

What to watch afterwards:

- npm weekly downloads: https://www.npmjs.com/package/definitely-not-a-robot (and npm-stat.com).
- GitHub stars, traffic and referrers: the repo's Insights → Traffic.
- New issues and discussions: answer within a day while the launch is fresh.
- Site traffic: Railway's metrics for the `site` service.

## Measurement

Recorded each wave.

| Date | npm weekly downloads | GitHub stars | Forks |
| --- | --- | --- | --- |
| 2026-11-03 | not published yet | 32 | 9 |
