// The stranger test: pack the library exactly as npm would publish it, install the tarball into
// an empty folder next to Playwright, then run the README quickstart, the demo recording, the
// synthetic-sessions recipe and the Puppeteer example, a CommonJS require and a type check against
// Playwright's and Puppeteer's real types.
// Then add @playwright/test and run the README's test file and the real-input recipe through the
// fixture.
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
const recipe = (name) => readFileSync(join(root, 'examples', name), 'utf8')
/** An example the README shows in full, so the two can't drift apart. */
const example = (name) => {
    const source = recipe(name)
    if (!readme.includes(source.trim())) {
        throw new Error(`README is out of sync with examples/${name}`)
    }
    return source
}
const quickstart = example('quickstart.mjs')
const recordDemo = example('record-demo.mjs')
const todoSpec = example('todo.spec.ts')
const puppeteerExample = example('puppeteer.mjs')
// The use-case recipes are too long for the README, which links to them; the site shows them in full.
const realInputSpec = recipe('real-input.spec.ts')
const syntheticSessions = recipe('synthetic-sessions.mjs')

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
    // puppeteer shares puppeteer-core's version numbers. Its own Chrome download is skipped: the
    // Puppeteer example runs on the Chromium Playwright already has.
    run(
        `npm install --no-audit --no-fund ./${tarball} playwright@${version('playwright')} puppeteer@${version('puppeteer-core')}`,
        dir,
        { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' }
    )

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

    step('run the synthetic-sessions recipe')
    writeFileSync(join(dir, 'synthetic-sessions.mjs'), syntheticSessions)
    const instant = { ...process.env, DNAR_SPEED: 'instant' }
    const sessions = [
        ...run('node synthetic-sessions.mjs', dir, instant).matchAll(/pointermove: (\d+)/g),
    ]
    if (sessions.length !== 3 || sessions.some(([, moves]) => Number(moves) === 0)) {
        throw new Error('the synthetic sessions did not each record pointer moves')
    }

    step("run the README Puppeteer example (headless, on Playwright's Chromium)")
    writeFileSync(
        join(dir, 'puppeteer.mjs'),
        puppeteerExample.replace('headless: false', 'headless: true')
    )
    const chromiumPath = run(
        `node --input-type=module -e "import { chromium } from 'playwright'; console.log(chromium.executablePath())"`,
        dir
    ).trim()
    run('node puppeteer.mjs', dir, { ...process.env, PUPPETEER_EXECUTABLE_PATH: chromiumPath })

    step('require() from CommonJS')
    run(
        `node -e "const m = require('definitely-not-a-robot'); if (typeof m.createHuman !== 'function') process.exit(1)"`,
        dir
    )

    // Everything above ran without @playwright/test installed: the core entry never imports it.
    step('add @playwright/test and run the README test file and the real-input recipe')
    run(`npm install --no-audit --no-fund @playwright/test@${version('@playwright/test')}`, dir)
    writeFileSync(join(dir, 'todo.spec.ts'), todoSpec)
    writeFileSync(join(dir, 'real-input.spec.ts'), realInputSpec)
    run('npx playwright test --reporter=line', dir, instant)
    run(
        `node -e "const m = require('definitely-not-a-robot/playwright'); if (typeof m.test.use !== 'function' || typeof m.createHuman !== 'function') process.exit(1)"`,
        dir
    )

    step("type-check the core and the fixture against Playwright's and Puppeteer's real types")
    writeFileSync(
        join(dir, 'check.ts'),
        [
            "import type { Page } from 'playwright'",
            "import { createHuman, type Human } from 'definitely-not-a-robot'",
            'declare const page: Page',
            'const human: Human<Page> = createHuman(page, { preset: "fast", seed: 1 })',
            "void human.click(page.getByRole('button'))",
            "import type { Page as PuppeteerPage } from 'puppeteer'",
            'declare const puppeteerPage: PuppeteerPage',
            "void createHuman(puppeteerPage, { seed: 1 }).click('#email')",
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
            include: ['*.ts'],
        })
    )
    run(`${join(root, 'node_modules/.bin/tsc')} -p ${dir}`)

    console.log('smoke: passed')
} finally {
    rmSync(dir, { recursive: true, force: true })
}
