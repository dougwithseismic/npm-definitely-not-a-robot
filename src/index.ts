import { PuppeteerExtra } from 'puppeteer-extra'
import HumanBrowser from './HumanBrowser'
;(async () => {
    const browser = new HumanBrowser()

    // Launch a browser window
    await browser.launch({
        headless: false, // Open a browser window visibly. Set to true to run in the background.
        // args: ['--start-maximized'], // Open the browser window maximized.
    })

    // Navigate to a sample website
    await browser.navigate('https://ui.shadcn.com/')

    await browser.moveToElement('input[type*="search"]', {
        scrollBeforeMove: true, // Scroll to bring the element to the center before moving the mouse
        variablePath: true, // Add randomness to the movement path
        hesitationBeforeClick: true, // Pause a bit before performing the click
        maxPause: 2, // Maximum possible pause (in milliseconds) during various actions
        minPause: 0, // Minimum possible pause (in milliseconds) during various actions
    })
    await browser.jitterMouse({
        jitterMin: 10,
        jitterMax: 100,
        jitterCount: 2, // Jitter the mouse 5 times
    })

    await browser.humanType('Hello World', 86) //Types 'Hello World' with a delay that mimics a humon's words per minute. (under the hood, we check the ascii difference between keys to add some randomness, too)
    await browser.jitterMouse()

    await browser.moveToElement('button[aria-label="Select a team"]', {
        hesitationBeforeClick: true, // Pause a bit before performing the click
        maxPause: 1, // Maximum possible pause (in milliseconds) during various actions
        minPause: 0, // Minimum possible pause (in milliseconds) during various actions
    })
    await browser.jitterMouse()

    await browser.wait(300, 500)
    await browser.jitterMouse({
        jitterMin: 1,
        jitterMax: 30,
        jitterCount: 2, // Jitter the mouse 5 times
    })
    await browser.humanType('Monste', 30) //Types 'Hello World' with a delay that mimics a humon's keyboard stretch (under the hood, we check the ascii difference between keys)

    await browser.wait(300, 500)
    await browser.jitterMouse()

    await browser.moveToElement('[data-value="monsters inc."]', {
        hesitationBeforeClick: true, // Pause a bit before performing the click
    })

    await browser.jitterMouse()

    await browser.moveToElement('a[href*="/examples/playground"]')
    // Let's assume the click opens a new page. Wait for some time before taking any action.

    await browser.wait(300, 500)

    await browser.jitterMouse()
    await browser.moveToElement('textarea', {
        target: 'top-left',
    })

    const HUMAN_TEXT = `Hello World! I am definitely a human, and not a robot mimicking small micro-stutters between words based on their distance on a physical keyboard! ah ah ah ah ah. `
    await browser.humanType(HUMAN_TEXT) 

    // ... You can add other actions or interactions as needed ...

    // Finally, close the browser after observing the result
    // await browser.close()
})()
