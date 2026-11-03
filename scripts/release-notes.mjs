// Prints what a release changed, from CHANGELOG.md, for its GitHub release:
//
//   node scripts/release-notes.mjs v1.0.1
//
// Releases are marked on the day headings ("## 2026-11-10 · v1.0.1"). A release covers its own day
// and any unmarked days below it, down to the previous release.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const wanted = process.argv[2]?.replace(/^v?/, 'v')
const lines = readFileSync(join(import.meta.dirname, '../CHANGELOG.md'), 'utf8').split('\n')
/** The version a "## <date> · v<version>" heading marks, if any. */
const versionOf = (line) => (line.startsWith('## ') ? line.split(' · ')[1]?.trim() : undefined)

const start = lines.findIndex((line) => versionOf(line) === wanted)
if (!wanted || start === -1) {
    console.error(
        `CHANGELOG.md has no heading for ${wanted ?? 'that version'}. Mark the day it ships: "## <date> · ${wanted ?? 'v1.2.3'}".`
    )
    process.exit(1)
}
const end = lines.findIndex((line, i) => i > start && versionOf(line))
const section = lines.slice(start + 1, end === -1 ? undefined : end)
// Unmarked day headings inside the release stay as headings, one level down.
console.log(
    section
        .map((line) => (line.startsWith('## ') ? `#${line}` : line))
        .join('\n')
        .trim()
)
