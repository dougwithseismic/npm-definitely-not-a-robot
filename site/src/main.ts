// Copy buttons: `data-copy` holds the text.
const copy = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch {
        // Blocked (an embedded frame, an old browser): the selection fallback.
        const area = Object.assign(document.createElement('textarea'), { value: text })
        document.body.append(area)
        area.select()
        const copied = document.execCommand('copy')
        area.remove()
        return copied
    }
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    const label = button.textContent
    button.addEventListener('click', async () => {
        button.textContent = (await copy(button.dataset.copy ?? '')) ? 'Copied' : 'Copy failed'
        setTimeout(() => {
            button.textContent = label
        }, 1500)
    })
}

// Code tabs: a `[role=tab]` shows the panel it `aria-controls`.
for (const list of document.querySelectorAll('[role=tablist]')) {
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role=tab]')]
    const select = (tab: HTMLButtonElement) => {
        for (const t of tabs) {
            const selected = t === tab
            t.setAttribute('aria-selected', String(selected))
            t.tabIndex = selected ? 0 : -1
            document
                .getElementById(t.getAttribute('aria-controls') ?? '')
                ?.toggleAttribute('hidden', !selected)
        }
    }
    for (const [i, tab] of tabs.entries()) {
        tab.addEventListener('click', () => select(tab))
        tab.addEventListener('keydown', (e) => {
            const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (!step) return
            const next = tabs[(i + step + tabs.length) % tabs.length]!
            select(next)
            next.focus()
        })
    }
}

// Demo clips start loading as they come near, and play only while they're on screen (never for
// reduced motion).
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const nearby = new IntersectionObserver(
    (entries) => {
        for (const { target, isIntersecting } of entries) {
            if (!isIntersecting) continue
            ;(target as HTMLVideoElement).preload = 'metadata'
            nearby.unobserve(target)
        }
    },
    { rootMargin: '600px 0px' }
)
const onScreen = new IntersectionObserver(
    (entries) => {
        for (const { target, isIntersecting } of entries) {
            const video = target as HTMLVideoElement
            if (isIntersecting && !reducedMotion) video.play().catch(() => {})
            else video.pause()
        }
    },
    { threshold: 0.4 }
)
for (const video of document.querySelectorAll('video')) {
    if (reducedMotion) video.controls = true
    nearby.observe(video)
    onScreen.observe(video)
}

// Only the home page has the demo, and it brings the library with it.
const demo = document.querySelector<HTMLElement>('[data-demo]')
if (demo) import('./demo').then(({ startDemo }) => startDemo(demo))
