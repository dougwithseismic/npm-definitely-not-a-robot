import HumanBrowser from './HumanBrowser'

;(async () => {
    const browser = new HumanBrowser()

    // Launch a browser window
    await browser.launch({
        headless: false, // Open a browser window visibly. Set to true to run in the background.
        args: ['--start-maximized'], // Open the browser window maximized.
    })

    // Navigate to a sample website
    await browser.navigate('https://example.com')

    // Move the mouse and click on a link with all the available options enabled
    await browser.humanMoveAndClick('a', {
        scrollBeforeMove: true, // Scroll to bring the element to the center before moving the mouse
        variablePath: true, // Add randomness to the movement path
        hesitationBeforeClick: true, // Pause a bit before performing the click
        maxPause: 1000, // Maximum possible pause (in milliseconds) during various actions
        minPause: 300, // Minimum possible pause (in milliseconds) during various actions
        debug: true, // Shows debugging visuals (like mouse path and click points)
        fadeDuration: 5000, // Debugging visuals will fade after 5 seconds
    })

    // Let's assume the click opens a new page. Wait for some time before taking any action.
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // ... You can add other actions or interactions as needed ...

    // Finally, close the browser after observing the result
    // await browser.close()
})()
