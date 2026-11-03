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

**Gaussian (normal) distribution.** The bell curve. Click points cluster near an element's centre
and thin out towards its edges, so we sample from a bell curve rather than uniformly.

**Log-normal distribution.** A skewed bell curve with a long tail on the slow side. Gaps between
keystrokes look like this: mostly quick, sometimes a long pause, never negative.

## Packaging

**ESM and CommonJS.** Two module systems in JavaScript: `import`/`export` (ESM, the standard) and
`require`/`module.exports` (CommonJS, Node's original). We ship both so the package works in any
project.

**Type declarations (`.d.ts`).** Files that describe a package's types for TypeScript and editor
autocomplete, without the code.

**Peer dependency.** A package we work *with* but expect you to install yourself, at the version
you choose (Playwright). Bundling our own copy would clash with yours.

**`exports` map.** The part of `package.json` that says which files `import 'definitely-not-a-robot'`
and `import 'definitely-not-a-robot/playwright'` resolve to.

**Side effect (on import).** Code that does something just because a module was imported. The old
version launched a browser on import; libraries should do nothing until called.

**Tarball / `pnpm pack`.** The `.tgz` file npm actually publishes. Our smoke test installs that
exact file into an empty folder, so we test what users get, not our source tree.

**Provenance.** A signed statement, shown on npm, that a published version was built from a
specific commit by a specific CI run. It tells users the package wasn't tampered with.
