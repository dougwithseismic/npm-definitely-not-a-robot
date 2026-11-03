# definitely-not-a-robot

Human-like mouse, keyboard and scroll input for Playwright. TypeScript library, no runtime
dependencies.

- Plan and rules: `docs/DECISIONS.md` (settled choices, how autopilot runs here),
  `docs/BACKLOG.md` (queue, launch bar, needs-you), `docs/prds/`.
- Terms: `docs/GLOSSARY.md`. Add new terms there when code introduces them.
- Gates: `pnpm check` then `pnpm smoke` before merging.
- Changelog entry in the same commit as the user-visible change, written for users.
- Every user-visible feature ships with a demo video of it in action (`pnpm demos`, from PRD 02).
- Add packages with `pnpm add <pkg>@latest`.
