import HumanBrowser from './HumanBrowser'

const HEADLESS_MODE = false
// const BROWSER_WINDOW_ARGUMENTS = ['--start-maximized'];

const DEFAULT_PAUSE_OPTIONS = {
    maxPause: 2,
    minPause: 0,
    hesitationBeforeClick: true,
}

const JITTER_DEFAULT = {
    jitterMin: 3,
    jitterMax: 30,
    jitterCount: 3,
    debug: true,
}
const URL = `https://ui.shadcn.com`
const SEARCH_BOX_SELECTOR = 'input[type*="search"]'
const TEAM_SELECT_BUTTON = 'button[aria-label="Select a team"]'
const MONSTER_SELECTION = '[data-value="monsters inc."]'
const NAVIGATION_LINK = 'a[href*="/examples/playground"]'
const TEXT_AREA_SELECTOR = 'textarea'

async function typeInSearchBox(browser: HumanBrowser, text: string, wordsPerMinute: number) {
    await browser.moveToElement(SEARCH_BOX_SELECTOR, DEFAULT_PAUSE_OPTIONS)
    await browser.jitterMouse(JITTER_DEFAULT)
    await browser.humanType(text, wordsPerMinute)
    await browser.jitterMouse()
}

async function selectTeam(browser: HumanBrowser) {
    await browser.moveToElement(TEAM_SELECT_BUTTON, DEFAULT_PAUSE_OPTIONS)
    await browser.jitterMouse()
}

async function typeMonsterName(browser: HumanBrowser, text: string, keyboardStretch: number) {
    await browser.wait(300, 500)
    await browser.jitterMouse({
        jitterMin: 1,
        jitterMax: 30,
        jitterCount: 2,
    })
    await browser.humanType(text, keyboardStretch)
    await browser.wait(300, 500)
    await browser.jitterMouse()
}

async function selectMonster(browser: HumanBrowser) {
    await browser.moveToElement(MONSTER_SELECTION, DEFAULT_PAUSE_OPTIONS)
    await browser.jitterMouse()
}

async function navigateToPlayground(browser: HumanBrowser) {
    await browser.moveToElement(NAVIGATION_LINK)
    await browser.wait(300, 500)
    await browser.jitterMouse()
}

async function typeTextArea(browser: HumanBrowser, text: string) {
    await browser.moveToElement(TEXT_AREA_SELECTOR, {
        target: 'top-left',
        ...DEFAULT_PAUSE_OPTIONS,
    })
    await browser.jitterMouse({
        jitterCount: 2,
    })
    await browser.humanType(text)
}

;(async () => {
    const browser = new HumanBrowser()

    await browser.launch({
        headless: HEADLESS_MODE,
        // args: BROWSER_WINDOW_ARGUMENTS
    })

    await browser.navigate(URL)

    await typeInSearchBox(browser, 'Hello World', 86)
    await selectTeam(browser)
    await typeMonsterName(browser, 'Monste', 30)
    await selectMonster(browser)
    await navigateToPlayground(browser)
    await typeTextArea(browser, `Hello World! I am definitely a human...`)

    // ... Continue with other actions ...

    // await browser.close();
})()
