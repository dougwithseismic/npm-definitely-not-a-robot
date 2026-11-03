/**
 * The landing site (`pnpm site:dev`, `pnpm site:build`). Pages are plain HTML with `<!--@name-->`
 * markers that are filled in at build time: the shared parts from `site/partials/<name>.html`, and
 * from the repo itself the README's FAQ and video captions, the examples, and CHANGELOG.md. Every
 * `index.html` under `site/` is a page.
 */
import {
    cpSync,
    createReadStream,
    existsSync,
    globSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    statSync,
} from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { Marked } from 'marked'
import { codeToHtml } from 'shiki'
import { defineConfig, type Plugin } from 'vite'

const root = resolve(import.meta.dirname, '..')
const media = join(root, 'docs/media')
const read = (file: string) => readFileSync(join(root, file), 'utf8')

/** Where the site and the project live, from package.json. The site URL is its `homepage`. */
const pkg = JSON.parse(read('package.json'))
const site = {
    url: pkg.homepage as string,
    repo: (pkg.repository.url as string).replace(/^git\+/, '').replace(/\.git$/, ''),
    npm: `https://www.npmjs.com/package/${pkg.name}`,
}
/** A page's URL from its file: "/", "/use-cases/demo-videos/" or "/404.html". */
const urlOf = (file: string) =>
    `/${relative(import.meta.dirname, file)
        .split(sep)
        .join('/')}`.replace(/index\.html$/, '')
/** The pages, by URL. All but the 404 go in the sitemap. */
const pages = globSync('**/index.html', {
    cwd: import.meta.dirname,
    exclude: ['dist/**', 'node_modules/**'],
})
    .map((file) => urlOf(join(import.meta.dirname, file)))
    .sort()

const markdown = new Marked({
    // Links relative to the README or changelog point at GitHub, where they resolve.
    walkTokens(token) {
        if (token.type !== 'link' || /^(https?:|mailto:)/.test(token.href)) return
        token.href = token.href.startsWith('#')
            ? `${site.repo}${token.href}`
            : `${site.repo}/blob/main/${token.href}`
    },
})
const render = (text: string) => markdown.parse(text, { async: false })

/** The body of a markdown section, from its heading to the next heading of the same level. */
function section(text: string, heading: string): string {
    const lines = text.split('\n')
    const start = lines.indexOf(heading)
    if (start === -1) throw new Error(`No "${heading}" section to put on the site`)
    const level = heading.indexOf(' ')
    const end = lines.findIndex(
        (line, i) => i > start && /^#+ /.test(line) && line.indexOf(' ') <= level
    )
    return lines
        .slice(start + 1, end === -1 ? undefined : end)
        .join('\n')
        .trim()
}

/** "### Something (PRD 03) · New" headings get a badge for the kind of change. */
const badges = (html: string) =>
    html.replace(
        /<h3>(.*?) · (\w+)<\/h3>/g,
        (_, title, kind) =>
            `<h3><span class="kind kind-${kind.toLowerCase()}">${kind}</span> ${title}</h3>`
    )

const code = (file: string) =>
    codeToHtml(read(file).trim(), { lang: extname(file).slice(1), theme: 'github-dark-default' })

/** Every demo in the README's "See it" table, with its caption. */
function videos(readme: string) {
    const found = [
        ...section(readme, '### See it').matchAll(
            /<img src="[^"]*\/docs\/media\/([\w-]+)\.gif" alt="([^"]+)">/g
        ),
    ].map(([, name, caption]) => ({ name: name as string, caption: caption as string }))
    if (!found.length) throw new Error('No demos found in the README\'s "See it" table')
    return found
}

/** A shared part of every page, with its link to the page it's on marked as the current one. */
const partial = (name: string, page: string) =>
    read(`site/partials/${name}.html`).replaceAll(
        `href="${page}"`,
        `href="${page}" aria-current="page"`
    )

/** The repo files the pages draw on, read once per page. */
interface Sources {
    readme: string
    /** The changelog from its first day: each page has its own title and intro. */
    days: string
}

function readSources(): Sources {
    const changelog = read('CHANGELOG.md')
    return { readme: read('README.md'), days: changelog.slice(changelog.indexOf('\n## ') + 1) }
}

/** `<!--@name-->`, or `<!--@example:file-->` for a file in examples/. */
const marker = /<!--@([\w-]+(?::[\w.-]+)?)-->/g

async function fill(name: string, { readme, days }: Sources, page: string): Promise<string> {
    const [kind, file = ''] = name.split(':')
    switch (kind) {
        case 'example':
            return code(`examples/${file}`)
        case 'faq':
            return render(section(readme, '## FAQ'))
        case 'responsible-use':
            return render(section(readme, '## Responsible use'))
        case 'gallery':
            return videos(readme)
                .map(
                    ({ name, caption }) => `<figure class="clip">
  <video src="/media/${name}.mp4#t=0.1" poster="/media/${name}.webp" muted loop playsinline preload="none" aria-label="${caption}"></video>
  <figcaption>${caption}</figcaption>
</figure>`
                )
                .join('\n')
        case 'changelog-latest': {
            // The three newest entries, under their days.
            const entries = [...days.matchAll(/^### /gm)].map((m) => m.index)
            return badges(render(days.slice(0, entries[3])))
        }
        case 'changelog':
            return badges(render(days))
        default:
            if (existsSync(join(root, `site/partials/${name}.html`))) return partial(name, page)
            throw new Error(`No content called "${name}" for the site`)
    }
}

const content = (): Plugin => ({
    name: 'dnar-content',
    transformIndexHtml: {
        order: 'pre',
        async handler(html, { filename }) {
            const page = urlOf(filename)
            const names = [...new Set([...html.matchAll(marker)].map((m) => m[1] as string))]
            const sources = readSources()
            const filled = new Map(
                await Promise.all(
                    names.map(async (n) => [n, await fill(n, sources, page)] as const)
                )
            )
            return html
                .replace(marker, (_, n) => filled.get(n) ?? '')
                .replaceAll('%SITE_URL%', site.url)
                .replaceAll('%REPO%', site.repo)
                .replaceAll('%NPM%', site.npm)
                .replaceAll('%VERSION%', pkg.version)
        },
    },
    // The demo videos and their posters live in docs/media; serve them in dev and copy them into the
    // build.
    configureServer(server) {
        server.middlewares.use('/media', (req, res, next) => {
            const file = join(media, (req.url ?? '').split('?')[0] ?? '')
            if (!file.startsWith(media + sep) || !existsSync(file)) return next()
            // Browsers fetch video in byte ranges (Safari won't play without them).
            const size = statSync(file).size
            const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '')
            const start = range ? Number(range[1]) : 0
            const end = range?.[2] ? Math.min(Number(range[2]), size - 1) : size - 1
            res.writeHead(range ? 206 : 200, {
                'Content-Type': file.endsWith('.webp') ? 'image/webp' : 'video/mp4',
                'Content-Length': end - start + 1,
                'Accept-Ranges': 'bytes',
                ...(range && { 'Content-Range': `bytes ${start}-${end}/${size}` }),
            })
            createReadStream(file, { start, end }).pipe(res)
        })
    },
    generateBundle() {
        this.emitFile({
            type: 'asset',
            fileName: 'sitemap.xml',
            source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${site.url}${p}</loc></url>`).join('\n')}
</urlset>
`,
        })
        this.emitFile({
            type: 'asset',
            fileName: 'robots.txt',
            source: `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`,
        })
    },
    writeBundle(options) {
        const out = join(options.dir ?? '', 'media')
        mkdirSync(out, { recursive: true })
        for (const file of readdirSync(media).filter((f) => /\.(mp4|webp)$/.test(f))) {
            cpSync(join(media, file), join(out, file))
        }
    },
})

export default defineConfig({
    root: import.meta.dirname,
    plugins: [content()],
    build: {
        rolldownOptions: {
            input: [
                ...pages.map((page) => join(import.meta.dirname, page, 'index.html')),
                join(import.meta.dirname, '404.html'),
            ],
        },
    },
})
