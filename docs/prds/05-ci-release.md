# PRD 05: CI and release

## Goal

Every push proves the package works; releases are one tag away and carry npm provenance.

## Acceptance criteria

- GitHub Actions on push and PR: install, types, lint, unit and integration tests (Chromium), build,
  pack smoke test. Badge in the README.
- A release workflow on `v*` tags publishes with `--provenance` using an `NPM_TOKEN` secret
  **(you: add the secret)** and creates a GitHub release from the changelog section.

## Implementation Notes
