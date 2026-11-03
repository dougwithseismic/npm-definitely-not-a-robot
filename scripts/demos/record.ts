/**
 * Records a short video of every feature with the library itself, into docs/media as an MP4 (for
 * the site) and a GIF (for the README). Needs ffmpeg on the PATH.
 *
 *   pnpm demos              all of them
 *   pnpm demos hero typing  just these
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Browser, chromium } from 'playwright'
import { createHuman } from '../../src'
import { type Scene, type Side, scenes } from './scenes'
import { stage } from './stage'

const OUT = join(import.meta.dirname, '../../docs/media')
const GIF_MAX_BYTES = 2_000_000
const GIF_MAX_SECONDS = 12

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
    const human = createHuman(page, {
        preset: 'demo',
        seed: 7,
        startPosition: scene.start,
        ...side.options,
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
    await context.close()
    return { file: await page.video()!.path(), start: (started - opened) / 1000, duration }
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
    const notes = [
        size > GIF_MAX_BYTES && 'GIF over 2 MB',
        duration > GIF_MAX_SECONDS && `over ${GIF_MAX_SECONDS}s`,
    ].filter(Boolean)
    const kb = (file: string) => `${Math.round(statSync(file).size / 1024)} KB`
    return `${scene.name}: ${duration.toFixed(1)}s, mp4 ${kb(mp4)}, gif ${kb(gif)}${notes.length ? `  (${notes.join(', ')})` : ''}`
}

const wanted = process.argv.slice(2)
const unknown = wanted.filter((name) => !scenes.some((s) => s.name === name))
if (unknown.length) {
    console.error(
        `No scene called ${unknown.join(', ')}. Scenes: ${scenes.map((s) => s.name).join(', ')}`
    )
    process.exit(1)
}

mkdirSync(OUT, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'dnar-demos-'))
const browser = await chromium.launch()
try {
    for (const scene of scenes.filter((s) => !wanted.length || wanted.includes(s.name))) {
        const clips: Clip[] = []
        for (const side of scene.sides) clips.push(await film(browser, scene, side, work))
        console.log(encode(scene, clips))
    }
} finally {
    await browser.close()
    rmSync(work, { recursive: true, force: true })
}
