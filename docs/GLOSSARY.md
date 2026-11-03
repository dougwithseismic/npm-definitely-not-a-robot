# Glossary

Plain-language definitions of the terms used in this codebase and its docs, with where each one
shows up. It grows as the library does.

## Design patterns

**Factory (factory function).** A function that builds and returns a ready-to-use object, so the
caller never uses `new` or knows how the object is put together. `createHuman(page)` is the
factory here. It reads the options, picks a driver, merges a preset and returns a `Human`. Because
callers only see the returned interface, the insides can change without breaking anyone.

**Adapter.** A thin layer that makes one API look like another. Playwright and Puppeteer both move
mice, but their method names and arguments differ. Each *driver* adapts one of them to the same
small `Driver` interface, so the rest of the library doesn't care which one it's talking to.

**Driver.** Our name for an adapter to an automation library (`playwrightDriver`,
`puppeteerDriver`). It knows how to move the mouse, press keys, scroll and find elements, and
nothing about being human.

**Strategy.** A swappable piece of behaviour behind a fixed shape. How the cursor travels is a
*motion* strategy (`bezierMotion()`); how keys are timed is a *typing* strategy
(`naturalTyping()`). You can pass your own as long as it has the same shape.

**Plugin / hooks.** A plugin is an object with optional functions (*hooks*) that the library calls
at known moments: `setup` when a human is created, `beforeAction` and `afterAction` around each
click or keystroke, `onMove` for each cursor step. The visible cursor is a plugin.

**Preset.** A named bundle of options (`'demo'`, `'fast'`). A shortcut, not a different code path.

**`define*` helpers.** `defineMotion`, `definePlugin`, `defineDriver` return exactly what you pass
in. They exist so TypeScript can check and autocomplete your object, the same trick as Vite's
`defineConfig`.

**Duck typing / structural typing.** "If it walks like a duck…": we decide whether something is a
Playwright page by checking it has the methods a Playwright page has, rather than importing
Playwright's classes. TypeScript does the same at compile time (*structural typing*): any object
with the right shape fits the type. This is why the library has no runtime dependencies.

## Making motion human

**Bezier curve.** A smooth curve defined by a start, an end and one or more *control points* that
pull the curve towards them without it touching them. Real hand movements arc rather than run
straight; a cubic Bezier (two control points) is a cheap, good-looking arc.

**Fitts's law.** A 1954 finding from human-factors research: the time to point at something grows
with the distance to it and shrinks with its size. `time = a + b × log2(distance / width + 1)`.
We use it to decide how long each movement takes, so a far, small button takes longer to reach
than a near, big one.

**Minimum-jerk easing.** People speed up and slow down smoothly when they move their arm, fastest
in the middle. *Jerk* is the rate of change of acceleration; the smoothest movement minimises it.
The resulting speed curve (`10t³ − 15t⁴ + 6t⁵`) decides how far along the path the cursor is at
each moment.

**Overshoot.** On long, fast movements people often go slightly past the target and correct back.
We do the same on some long moves.

**Tremor.** Tiny involuntary wobble in a hand. A few pixels of noise along the path.

**Round trip.** One message to the browser and its reply, a few milliseconds each. Every mouse
step is one, so instant mode sends a few points per move instead of dozens.

**Plan, then play.** We first compute the whole movement as a list of timed points (*plan*), then
send them to the browser on a clock (*play*). Planning is pure maths, so it can be tested without a
browser and even run on the landing page.

**Pure function.** A function whose output depends only on its inputs and that changes nothing
outside itself. Easy to test: same input, same output.

## Randomness

**PRNG (pseudo-random number generator).** A formula that produces numbers that look random but
are fully determined by a starting value. We use *Mulberry32*, a tiny, fast one.

**Seed.** The starting value for a PRNG. Same seed, same sequence. `createHuman(page, { seed: 42 })`
replays identical paths and timings, which makes a flaky test reproducible and a demo video
re-recordable frame for frame.

**Random stream.** One seed split into several independent sequences. Each action draws from its
own stream, so if one action has to retry (a slow page, a banner that takes a while to go), the
extra numbers it uses can't change what the actions after it do.

**Gaussian (normal) distribution.** The bell curve. Click points cluster near an element's centre
and thin out towards its edges, so we sample from a bell curve rather than uniformly.

**Log-normal distribution.** A skewed bell curve with a long tail on the slow side. Gaps between
keystrokes look like this: mostly quick, sometimes a long pause, never negative.

## Clicking safely

**Hit test.** Asking the browser "what's the topmost element at this point?" before pressing. If
it isn't the target, the click would land on something else.

**Covered vs clipped.** *Covered*: something sits on top of the target (a cookie banner, a modal).
*Clipped*: the target is scrolled out of sight inside a scrolling panel or an iframe, so the point
shows something else. Covered waits or throws `TARGET_COVERED`; clipped scrolls the panel first.

**Strict mode (Playwright).** A locator must match exactly one element when you act on it. If it
matches several, Playwright refuses, and we say so as `TARGET_AMBIGUOUS`.

## Drawing in the page

**Overlay.** Something we draw on top of the page (the cursor, the click ring, the trail) without
changing the page itself. It ignores the mouse (`pointer-events: none`), so clicks go straight
through to the page.

**Shadow DOM, closed shadow root.** A private sub-tree attached to an element. The page's CSS
can't reach inside, so a site's styles can't restyle or hide the cursor. *Closed* means page
scripts can't reach in either.

**Top layer.** Where the browser puts dialogs, popovers and full-screen elements: above every
z-index. The cursor is shown there as a popover, and moves back to the top when a dialog opens.

**Init script.** A script the automation library runs at the start of every new document, before
the page's own scripts (`page.addInitScript`). It's how the cursor survives navigation.

**CSP (Content Security Policy).** A page's rules about what scripts and styles may run. Strict
pages block inline `<style>` and `<script>` tags; the overlay uses neither, so it still works.

**`__name` helper.** A function some compilers (esbuild with `keepNames`, which tsx uses) wrap
around other functions to preserve their names. It only exists in Node, so a function serialised
into the page would fail. We give the page a stand-in.

## Playwright Test

**Fixture.** A value Playwright Test sets up for each test and hands over by name: `page`,
`context`, and our `human`. A test asks for what it needs in its arguments
(`async ({ page, human }) => …`); Playwright builds it before the test and cleans up after, and
only builds the ones a test asks for. `test.extend()` adds new fixtures.

**Option fixture.** A fixture that is a setting rather than an object, changed with `test.use()`
in a file or `use` in `playwright.config.ts`. `humanOptions` is one.

**`mergeTests`.** Playwright's way to combine two `test` objects that each add fixtures, so our
`human` can sit next to your own.

## Packaging

**ESM and CommonJS.** Two module systems in JavaScript: `import`/`export` (ESM, the standard) and
`require`/`module.exports` (CommonJS, Node's original). We ship both so the package works in any
project.

**Type declarations (`.d.ts`).** Files that describe a package's types for TypeScript and editor
autocomplete, without the code.

**Peer dependency.** A package we work *with* but expect you to install yourself, at the version
you choose (Playwright). Bundling our own copy would clash with yours. An *optional* peer
(`@playwright/test` for us) only matters if you use the part that needs it: nothing installs or
loads it for you, and the core never imports it.

**Entry point (subpath export).** A separate front door into the package.
`definitely-not-a-robot/playwright` is a second entry point, its own file in `dist/`, so importing
the core never loads the test runner.

**Bundler (tsdown).** The tool that turns `src/` into the files in `dist/`: ESM and CommonJS
builds plus type declarations. Ours also runs *publint* and *arethetypeswrong*, two checkers that
fail the build if any way of importing the package (ESM, CommonJS, TypeScript's resolvers) would
find the wrong file.

**`exports` map.** The part of `package.json` that says which files `import 'definitely-not-a-robot'`
and `import 'definitely-not-a-robot/playwright'` resolve to.

**Side effect (on import).** Code that does something just because a module was imported. The old
version launched a browser on import; libraries should do nothing until called.

**Tarball / `pnpm pack`.** The `.tgz` file npm actually publishes. Our smoke test installs that
exact file into an empty folder, so we test what users get, not our source tree.

**Provenance.** A signed statement, shown on npm, that a published version was built from a
specific commit by a specific CI run. It tells users the package wasn't tampered with.

## Releasing

**Semver (semantic versioning).** `major.minor.patch`. Patch: fixes only. Minor: new features,
nothing breaks. Major: something you rely on changed, so read the changelog before upgrading.

**Tag (git tag).** A name pinned to one commit, like `v1.0.1`. Pushing a tag that starts with `v`
is what starts our release workflow.

**Trusted publishing.** npm's way to let a CI workflow publish without a stored password or token.
GitHub Actions proves to npm which repository and workflow file is running (with a short-lived
*OIDC token*, an ID card issued for that one run), and npm accepts it because the package owner
linked that workflow to the package. It also makes provenance automatic.

**One-time password (2FA code).** The six-digit code from an authenticator app that npm asks for
on publish when two-factor authentication is on. Only the account owner can type it.

## The website

**Static site.** A website made of plain files (HTML, CSS, JavaScript, videos) built ahead of
time, with no server code running per visit. Ours is built by Vite from `site/` and fills itself in
from the README, the examples and `CHANGELOG.md`, so the FAQ, video captions, code samples and
changelog on it always match the repo. The landing copy around them is written for the site.

**Partial.** A piece of HTML shared between pages, such as the header, footer and closing call to
action in `site/partials/`, put in place of a marker like `<!--@header-->` when the site is built.

**Use-case page.** A page on the website for one job people hire the library for (demo videos,
tests that need real input, checking your own analytics). It leads with the pain, shows a video,
says plainly where Playwright alone falls short, and ends with a recipe.

**Recipe.** A complete, runnable example in `examples/` for one use case. The website shows each
recipe straight from its file, and the smoke test runs it against the packed package, so the code
people copy is code that works.

**Synthetic session.** A scripted visit that moves, types and scrolls like a person, used to check
your own analytics, heatmaps, session replay or bot rules on a site you own. Give each one a seed
and it can be run again when its recording looks wrong.

**Stage driver.** The small driver in `site/src/demo.ts` that lets `createHuman` run inside the
website's demo box: its mouse events move a drawn cursor instead of a real one. It shows the
driver interface at its smallest.

**Build-time content.** Text pulled in while the site is built rather than when someone visits.
The `<!--@faq-->` style markers in `site/*.html` are replaced with the README's FAQ, the
changelog and highlighted code at build time.

**Open Graph image.** The picture social apps and chat tools show when someone shares a link.
`site/public/og.png`, rendered by `pnpm site:og` from the library's own motion planner.

**Container (Docker image).** A packaged, self-contained copy of an app and everything it needs to
run. `site/Dockerfile` builds the site in one stage, then copies the finished files into a small
web server image (Caddy) that Railway runs.

**Reduced motion.** A system setting people use when animation makes them unwell. With it on, the
site's demo doesn't play by itself and videos don't autoplay.

