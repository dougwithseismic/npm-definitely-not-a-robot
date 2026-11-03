/**
 * Records a short video of every feature with the library itself, into docs/media as an MP4 and a
 * poster frame (for the site) and a GIF (for the README). Needs ffmpeg and cwebp on the PATH
 * (`brew install ffmpeg webp`).
 *
 *   pnpm demos              all of them
 *   pnpm demos hero typing  just these
 *   pnpm demos --posters    only the poster frames, from the MP4s already there
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { type AddressInfo, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Browser, chromium, type Page } from 'playwright'
import puppeteer from 'puppeteer-core'
import { createHuman, playwrightDriver, puppeteerDriver } from '../../src'
import { type Scene, type Side, scenes } from './scenes'
import { stage } from './stage'

const OUT = join(import.meta.dirname, '../../docs/media')
const GIF_MAX_BYTES = 2_000_000
const GIF_MAX_SECONDS = 12
/** A free port where Puppeteer reaches the browser, for sides it drives. */
const debugPort = await new Promise<number>((resolve) => {
    const server = createServer().listen(0, () => {
        const { port } = server.address() as AddressInfo
        server.close(() => resolve(port))
    })
})

interface Clip {
    file: string
    /** Seconds into the file where the scene starts. */
    start: number
    duration: number
}

async function film(browser: Browser, scene: Scene, side: Side, dir: string): Promise<Clip> {
    const context = await browser.newContext({
        viewport: scene.viewport,
        recordVideo: { dir, size: scene.viewport },
    })
    const page = await context.newPage()
    const opened = Date.now()
    await page.setContent(stage(side.stage))
    const driven = side.driver === 'puppeteer' ? await asPuppeteer(page) : undefined
    const base = driven ? puppeteerDriver(driven.page) : playwrightDriver(page)
    const human = createHuman((driven?.page ?? page) as Page, {
        preset: 'demo',
        seed: 7,
        startPosition: scene.start,
        ...side.options,
        ...(side.wrapDriver && { driver: side.wrapDriver(base) }),
    })
    await human.move(scene.start) // draws the cursor where it starts
    await page.waitForTimeout(500)
    const started = Date.now()
    await side.run({
        page,
        human,
        code: (text) => page.evaluate((t) => (window as any).code(t), text),
    })
    await page.waitForTimeout(1500)
    const duration = (Date.now() - started) / 1000
    await driven?.browser.disconnect()
    await context.close()
    return { file: await page.video()!.path(), start: (started - opened) / 1000, duration }
}

/** The same tab as a Puppeteer page, so Playwright films what Puppeteer drives. */
async function asPuppeteer(page: Page) {
    const marker = `take-${Date.now()}`
    await page.evaluate((name) => {
        window.name = name
    }, marker)
    const browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${debugPort}`,
        defaultViewport: null,
    })
    for (const tab of await browser.pages()) {
        if ((await tab.evaluate(() => window.name)) === marker) return { page: tab, browser }
    }
    await browser.disconnect()
    throw new Error("Puppeteer couldn't find the tab to drive")
}

const ffmpeg = (args: string[]) =>
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
        stdio: 'inherit',
    })

/** ffmpeg inputs and a filter that trims each clip and, for two, puts them side by side. */
function compose(clips: Clip[]): { inputs: string[]; filter: string; duration: number } {
    const duration = Math.max(...clips.map((c) => c.duration))
    const inputs = clips.flatMap((c) => ['-ss', c.start.toFixed(2), '-i', c.file])
    if (clips.length === 1) return { inputs, filter: `[0:v]trim=duration=${duration}[v]`, duration }
    // The shorter side holds its last frame until the longer one finishes. A dark rule divides them.
    const padded = clips.map(
        (c, i) =>
            `[${i}:v]trim=duration=${c.duration},tpad=stop_mode=clone:stop_duration=${(duration - c.duration + 0.2).toFixed(2)}${i < clips.length - 1 ? ',pad=iw+6:ih:0:0:color=0x0f172a' : ''}[v${i}]`
    )
    const stack = `${clips.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${clips.length},trim=duration=${duration}[v]`
    return { inputs, filter: [...padded, stack].join(';'), duration }
}

function encode(scene: Scene, clips: Clip[]): string {
    const { inputs, filter, duration } = compose(clips)
    const mp4 = join(OUT, `${scene.name}.mp4`)
    ffmpeg([
        ...inputs,
        '-filter_complex',
        filter,
        '-map',
        '[v]',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        '23',
        '-preset',
        'slow',
        '-movflags',
        '+faststart',
        '-an',
        mp4,
    ])
    // GIFs: the largest that fits the README budget.
    const gif = join(OUT, `${scene.name}.gif`)
    const width = scene.viewport.width * clips.length
    let size = 0
    for (const [fps, scale] of [
        [15, 0.75],
        [12, 0.66],
        [10, 0.6],
        [10, 0.5],
    ] as const) {
        const w = Math.round((width * scale) / 2) * 2
        ffmpeg([
            '-i',
            mp4,
            '-vf',
            `fps=${fps},scale=${w}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
            gif,
        ])
        size = statSync(gif).size
        if (size <= GIF_MAX_BYTES) break
    }
    const still = poster(mp4)
    const notes = [
        size > GIF_MAX_BYTES && 'GIF over 2 MB',
        duration > GIF_MAX_SECONDS && `over ${GIF_MAX_SECONDS}s`,
    ].filter(Boolean)
    return `${scene.name}: ${duration.toFixed(1)}s, mp4 ${kb(mp4)}, poster ${kb(still)}, gif ${kb(gif)}${notes.length ? `  (${notes.join(', ')})` : ''}`
}

/**
 * The still a video shows before it plays (the site loads videos only when they scroll near):
 * the frame at 0.1s, where the site starts playing, so nothing jumps when it does.
 */
function poster(mp4: string): string {
    const png = join(work, 'poster.png')
    const webp = mp4.replace(/\.mp4$/, '.webp')
    ffmpeg(['-ss', '0.1', '-i', mp4, '-frames:v', '1', png])
    execFileSync('cwebp', ['-quiet', '-q', '80', png, '-o', webp])
    return webp
}

const kb = (file: string) => `${Math.round(statSync(file).size / 1024)} KB`

const postersOnly = process.argv.includes('--posters')
const wanted = process.argv.slice(2).filter((arg) => arg !== '--posters')
const unknown = wanted.filter((name) => !scenes.some((s) => s.name === name))
if (unknown.length) {
    console.error(
        `No scene called ${unknown.join(', ')}. Scenes: ${scenes.map((s) => s.name).join(', ')}`
    )
    process.exit(1)
}

mkdirSync(OUT, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'dnar-demos-'))
const chosen = scenes.filter((s) => !wanted.length || wanted.includes(s.name))
try {
    if (postersOnly) {
        for (const scene of chosen) {
            console.log(`${scene.name}: poster ${kb(poster(join(OUT, `${scene.name}.mp4`)))}`)
        }
    } else {
        const browser = await chromium.launch({ args: [`--remote-debugging-port=${debugPort}`] })
        try {
            for (const scene of chosen) {
                const clips: Clip[] = []
                for (const side of scene.sides) clips.push(await film(browser, scene, side, work))
                console.log(encode(scene, clips))
            }
        } finally {
            await browser.close()
        }
    }
} finally {
    rmSync(work, { recursive: true, force: true })
}
