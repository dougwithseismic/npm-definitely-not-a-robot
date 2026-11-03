/**
 * The page every demo is filmed on: a header naming the feature, the scene in the middle, and a
 * code bar along the bottom showing the line that's running (`window.code(text)`). With `keys`,
 * a strip in the corner shows each key press as it happens, and each burst of scrolling with the
 * distance it covers.
 */
export interface StageOptions {
    /** Right side of the header, such as "Typing". */
    label: string
    /** Grey label instead of the accent colour, for the "before" side of a comparison. */
    plain?: boolean
    body: string
    css?: string
    script?: string
    keys?: boolean
}

export const stage = ({
    label,
    plain,
    body,
    css = '',
    script = '',
    keys = false,
}: StageOptions) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
:root { --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; --bg: #f8fafc; --accent: #4f46e5;
    --good: #16a34a; --bad: #dc2626; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font: 17px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    color: var(--ink); background: var(--bg); min-height: 100vh; padding-bottom: 64px;
    -webkit-font-smoothing: antialiased; }
header { position: sticky; top: 0; z-index: 5; height: 52px; display: flex; align-items: center;
    justify-content: space-between; padding: 0 24px; background: #fff;
    border-bottom: 1px solid var(--line); }
.brand { display: flex; gap: 9px; align-items: center; font-weight: 650; font-size: 15px;
    letter-spacing: -.01em; }
.brand i { width: 11px; height: 11px; border-radius: 3px; background: var(--accent); }
.label { font-size: 14px; font-weight: 600; padding: 5px 12px; border-radius: 99px;
    background: #eef2ff; color: var(--accent); }
.label.plain { background: #f1f5f9; color: var(--muted); }
footer { position: fixed; z-index: 5; left: 0; right: 0; bottom: 0; height: 64px; display: flex;
    align-items: center; gap: 12px; padding: 0 24px; background: #0f172a; color: #e2e8f0;
    font: 16px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
footer .gt { color: #475569; }
#code { transition: opacity .2s; }
#code .kw { color: #c4b5fd; } #code .str { color: #86efac; } #code .obj { color: #7dd3fc; }
#code .com { color: #64748b; }
#keys { position: fixed; z-index: 6; left: 50%; transform: translateX(-50%); bottom: 84px;
    display: flex; gap: 8px; flex-direction: row-reverse; }
#keys span { min-width: 42px; height: 42px; padding: 0 12px; display: grid; place-items: center;
    border-radius: 9px; background: #fff; border: 1px solid #cbd5e1;
    box-shadow: 0 3px 0 #cbd5e1; font: 600 17px ui-monospace, Menlo, monospace;
    white-space: nowrap; transition: opacity .6s; }
#keys span.mod { background: #eef2ff; border-color: #c7d2fe; color: var(--accent); }
#keys span.fix { background: #fef2f2; border-color: #fecaca; color: var(--bad); }
button { font: inherit; cursor: pointer; }
.card { background: #fff; border: 1px solid var(--line); border-radius: 14px;
    box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06); }
.btn { border: 0; border-radius: 10px; padding: 11px 20px; background: var(--accent); color: #fff;
    font-weight: 600; }
input, textarea { font: inherit; color: inherit; width: 100%; padding: 10px 12px;
    border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; outline: none; }
input:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px #e0e7ff; }
${css}
</style></head><body>
<header><div class="brand"><i></i>definitely-not-a-robot</div><div class="label${plain ? ' plain' : ''}">${label}</div></header>
${body}
<footer><span class="gt">&gt;</span><span id="code"></span></footer>
${keys ? '<div id="keys"></div>' : ''}
<script>
const escape = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
window.code = (text) => {
    const el = document.getElementById('code')
    el.innerHTML = escape(text)
        .replace(/(\\/\\/.*)$/, '<span class="com">$1</span>')
        .replace(/('[^']*')/g, '<span class="str">$1</span>')
        .replace(/\\b(await|const)\\b/g, '<span class="kw">$1</span>')
        .replace(/\\b(human|page)\\b/g, '<span class="obj">$1</span>')
}
const keys = document.getElementById('keys')
const NAMES = { ' ': '␣', Shift: '⇧ Shift', Backspace: '⌫', Enter: '⏎' }
/** Show a chip, or keep one showing while it changes. */
const fadeLater = (el) => {
    clearTimeout(el.fade)
    el.fade = setTimeout(() => { el.style.opacity = '0' }, 1400)
}
const chip = (text, kind) => {
    const el = document.createElement('span')
    el.textContent = text
    if (kind) el.className = kind
    keys.prepend(el)
    while (keys.children.length > 10) keys.lastChild.remove()
    fadeLater(el)
    return el
}
// Wheel events close together, one way, make one chip that counts up the distance.
let burst = { el: null, at: 0, way: '', px: 0 }
if (keys) {
    addEventListener('keydown', (e) => chip(NAMES[e.key] ?? e.key,
        e.key === 'Shift' ? 'mod' : e.key === 'Backspace' ? 'fix' : ''), true)
    addEventListener('wheel', (e) => {
        const way = Math.abs(e.deltaY) >= Math.abs(e.deltaX)
            ? (e.deltaY > 0 ? '↓' : '↑') : (e.deltaX > 0 ? '→' : '←')
        if (!burst.el || e.timeStamp - burst.at > 90 || burst.way !== way)
            burst = { el: chip('', 'mod'), at: 0, way, px: 0 }
        burst.at = e.timeStamp
        burst.px += Math.hypot(e.deltaX, e.deltaY)
        burst.el.textContent = 'wheel ' + way + ' ' + Math.round(burst.px) + ' px'
        fadeLater(burst.el)
    }, true)
}
${script}
</script>
</body></html>`
