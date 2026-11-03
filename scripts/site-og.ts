/**
 * Renders the site's Open Graph image (`pnpm site:og`), the card shown when the site is shared.
 * The two paths are the library's own: Playwright's straight jump next to a planned human move.
 */
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createRandom } from '../src'
import { bezierMotion } from '../src/motion'
import { presets } from '../src/presets'

const out = join(import.meta.dirname, '../site/public/og.png')
const from = { x: 640, y: 520 }
const to = { x: 1080, y: 250 }
const options = presets.demo.motion
const motion = options && 'plan' in options ? options : bezierMotion(options)
const path = motion.plan({
    from,
    to,
    targetSize: 48,
    random: createRandom(7),
})
const d = `M${from.x} ${from.y} ${path.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}`
const arrow = (x: number, y: number, fill: string) =>
    `<path transform="translate(${x - 5 * 1.6} ${y - 2.5 * 1.6}) scale(1.6)" d="M5 2.5v17.2l4.3-4.1 2.9 6.6 2.9-1.3-2.9-6.5h6.1z" fill="${fill}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: #f8fafc;
    background-image: radial-gradient(circle at 1px 1px, #e2e8f0 1.2px, transparent 0);
    background-size: 26px 26px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    color: #0f172a; -webkit-font-smoothing: antialiased; position: relative; }
.copy { position: absolute; left: 72px; top: 72px; width: 640px; }
.brand { display: flex; gap: 12px; align-items: center; font-weight: 650; font-size: 26px; }
.brand i { width: 16px; height: 16px; border-radius: 4px; background: #4f46e5; }
h1 { margin-top: 40px; font-size: 64px; line-height: 1.04; letter-spacing: -0.035em; }
h1 span { color: #4f46e5; }
p { margin-top: 28px; font: 26px ui-monospace, SFMono-Regular, Menlo, monospace; color: #475569; }
svg { position: absolute; inset: 0; }
.target { position: absolute; left: ${to.x - 150}px; top: ${to.y - 30}px; width: 210px; height: 60px;
    border-radius: 14px; background: #4f46e5; color: #fff; font-weight: 650; font-size: 24px;
    display: flex; align-items: center; padding-left: 30px; box-shadow: 0 10px 30px rgba(79, 70, 229, .25); }
</style></head><body>
<div class="target">Sign up</div>
<svg width="1200" height="630">
  <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#94a3b8" stroke-width="3" stroke-dasharray="3 10" stroke-linecap="round"/>
  <path d="${d}" fill="none" stroke="#4f46e5" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  ${arrow(to.x + 26, to.y + 8, '#94a3b8')}
  ${arrow(path.at(-1)!.x, path.at(-1)!.y, '#4f46e5')}
</svg>
<div class="copy">
  <div class="brand"><i></i>definitely-not-a-robot</div>
  <h1>Your Playwright scripts click like robots. <span>Make them move like people.</span></h1>
  <p>npm install definitely-not-a-robot</p>
</div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.screenshot({ path: out })
await browser.close()
console.log(`Wrote ${out}`)
