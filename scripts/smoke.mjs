// The stranger test: pack the library exactly as npm would publish it, install the tarball into
// an empty folder next to Playwright, then run the README quickstart, a CommonJS require and a
// type check against Playwright's real types.
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' })
const step = (label) => console.log(`smoke: ${label}`)

const quickstart = readFileSync(join(root, 'examples/quickstart.mjs'), 'utf8')
if (!readFileSync(join(root, 'README.md'), 'utf8').includes(quickstart.trim())) {
    throw new Error('README quickstart is out of sync with examples/quickstart.mjs')
}

const dir = mkdtempSync(join(tmpdir(), 'dnar-smoke-'))
try {
    step('build and pack')
    run('pnpm build')
    run(`pnpm pack --pack-destination ${dir}`)
    const tarball = readdirSync(dir).find((f) => f.endsWith('.tgz'))
    const playwright = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).devDependencies
        .playwright

    step(`install ${tarball} into an empty project`)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'stranger', type: 'module' }))
    run(
        `npm install --no-audit --no-fund ./${tarball} playwright@${playwright.replace('^', '')}`,
        dir
    )

    step('run the README quickstart (headless)')
    writeFileSync(
        join(dir, 'quickstart.mjs'),
        quickstart.replace('headless: false', 'headless: true')
    )
    run('node quickstart.mjs', dir)

    step('require() from CommonJS')
    run(
        `node -e "const m = require('definitely-not-a-robot'); if (typeof m.createHuman !== 'function') process.exit(1)"`,
        dir
    )

    step("type-check against Playwright's real Page type")
    writeFileSync(
        join(dir, 'check.ts'),
        [
            "import type { Page } from 'playwright'",
            "import { createHuman, type Human } from 'definitely-not-a-robot'",
            'declare const page: Page',
            'const human: Human<Page> = createHuman(page, { preset: "fast", seed: 1 })',
            "void human.click(page.getByRole('button'))",
            '',
        ].join('\n')
    )
    writeFileSync(
        join(dir, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: {
                strict: true,
                target: 'ES2022',
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
                noEmit: true,
                // Playwright's own declarations need @types/node; we're checking how ours meet them.
                skipLibCheck: true,
                types: [],
            },
            files: ['check.ts'],
        })
    )
    try {
        run(`${join(root, 'node_modules/.bin/tsc')} -p ${dir}`)
    } catch (error) {
        throw new Error(`type check failed:\n${error.stdout}`)
    }

    console.log('smoke: passed')
} finally {
    rmSync(dir, { recursive: true, force: true })
}
