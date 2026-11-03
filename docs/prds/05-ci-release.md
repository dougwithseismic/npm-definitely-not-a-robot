# PRD 05: CI and release

## Goal

Every push proves the package works; releases are one tag away and carry npm provenance.

## Acceptance criteria

- GitHub Actions on push and PR: install, types, lint, unit and integration tests (Chromium), build,
  pack smoke test. Badge in the README.
- A release workflow on `v*` tags publishes with `--provenance` using an `NPM_TOKEN` secret
  **(you: add the secret)** and creates a GitHub release from the changelog section.

## Implementation Notes

CI checks and the pack smoke test shipped 2026-11-03 with PRD 01 (`.github/workflows/ci.yml`, badge
in the README). Release workflow, 2026-11-03:

- `.github/workflows/release.yml` runs on `v*` tags. It checks the tag matches `package.json`,
  builds the notes, runs smoke, then `npm publish` (whose `prepublishOnly` runs `pnpm check`) and
  `gh release create` with the notes.
- Changed from the PRD: npm trusted publishing instead of an `NPM_TOKEN` secret. npm now limits
  publish tokens to short lifetimes, a stored token is the thing that leaks, and trusted publishing
  makes provenance automatic. It needs npm 11.5.1+, so the job runs on Node 24, and the package has
  to exist on npm before it can be linked, so 1.0.0 is published from the user's machine.
- `scripts/release-notes.mjs v<version>` prints a release's changelog: its marked day heading plus
  any unmarked days below it. CI runs it for `package.json`'s version on every push, so a version
  bump without a changelog heading fails before anyone tags it.
- Steps to cut a release are in DECISIONS, "Releases".
