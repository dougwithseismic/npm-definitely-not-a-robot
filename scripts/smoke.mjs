// The stranger test: pack the library exactly as npm would publish it, install the tarball into
// an empty folder next to Playwright, then run the README quickstart and demo recording, a CommonJS
// require and a type check against Playwright's real types. Then add @playwright/test and run the
// README's test file through the fixture.
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const run = (cmd, cwd = root, env = process.env) => {
    try {
        return execSync(cmd, { cwd, env, stdio: 'pipe', encoding: 'utf8' })
    } catch (error) {
        // Playwright and tsc report failures on stdout.
        throw new Error(`${cmd} failed:\n${error.stdout}${error.stderr}`)
    }
}
const step = (label) => console.log(`smoke: ${label}`)

const readme = readFileSync(join(root, 'README.md'), 'utf8')
const example = (name) => {
    const source = readFileSync(join(root, 'examples', name), 'utf8')
    if (!readme.includes(source.trim())) {
        throw new Error(`README is out of sync with examples/${name}`)
    }
    return source
}
const quickstart = example('quickstart.mjs')
const recordDemo = example('record-demo.mjs')
const todoSpec = example('todo.spec.ts')

const dir = mkdtempSync(join(tmpdir(), 'dnar-smoke-'))
try {
    step('build and pack')
    run('pnpm build')
    run(`pnpm pack --pack-destination ${dir}`)
    const tarball = readdirSync(dir).find((f) => f.endsWith('.tgz'))
    const devDependencies = JSON.parse(
        readFileSync(join(root, 'package.json'), 'utf8')
    ).devDependencies
    const version = (name) => devDependencies[name].replace('^', '')

    step(`install ${tarball} into an empty project`)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'stranger', type: 'module' }))
    run(`npm install --no-audit --no-fund ./${tarball} playwright@${version('playwright')}`, dir)

    step('run the README quickstart (headless)')
    writeFileSync(
        join(dir, 'quickstart.mjs'),
        quickstart.replace('headless: false', 'headless: true')
    )
    run('node quickstart.mjs', dir)

    step('record the README demo video')
    writeFileSync(join(dir, 'record-demo.mjs'), recordDemo)
    run('node record-demo.mjs', dir)
    const video = readdirSync(join(dir, 'videos')).find((f) => f.endsWith('.webm'))
    if (!video || statSync(join(dir, 'videos', video)).size < 10_000) {
        throw new Error('the demo recording wrote no video')
    }

    step('require() from CommonJS')
    run(
        `node -e "const m = require('definitely-not-a-robot'); if (typeof m.createHuman !== 'function') process.exit(1)"`,
        dir
    )

    // Everything above ran without @playwright/test installed: the core entry never imports it.
    step('add @playwright/test and run the README test file through the fixture')
    run(`npm install --no-audit --no-fund @playwright/test@${version('@playwright/test')}`, dir)
    writeFileSync(join(dir, 'todo.spec.ts'), todoSpec)
    run('npx playwright test --reporter=line', dir, { ...process.env, DNAR_SPEED: 'instant' })
    run(
        `node -e "const m = require('definitely-not-a-robot/playwright'); if (typeof m.test.use !== 'function' || typeof m.createHuman !== 'function') process.exit(1)"`,
        dir
    )

    step("type-check the core and the fixture against Playwright's real types")
    writeFileSync(
        join(dir, 'check.ts'),
        [
            "import type { Page } from 'playwright'",
            "import { createHuman, type Human } from 'definitely-not-a-robot'",
            'declare const page: Page',
            'const human: Human<Page> = createHuman(page, { preset: "fast", seed: 1 })',
            "void human.click(page.getByRole('button'))",
            '',
            "import { defineConfig, type Page as TestPage } from '@playwright/test'",
            "import { expect, test, type HumanFixtures } from 'definitely-not-a-robot/playwright'",
            "defineConfig<HumanFixtures>({ use: { video: 'on', humanOptions: { preset: 'demo' } } })",
            "test.use({ humanOptions: { preset: 'demo', seed: 1 } })",
            "test('typed', async ({ page, human }) => {",
            '    const mine: Human<TestPage> = human',
            "    await mine.click(page.getByRole('button'))",
            "    await expect(page).toHaveTitle('Done')",
            '})',
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
            files: ['check.ts', 'todo.spec.ts'],
        })
    )
    run(`${join(root, 'node_modules/.bin/tsc')} -p ${dir}`)

    console.log('smoke: passed')
} finally {
    rmSync(dir, { recursive: true, force: true })
}
