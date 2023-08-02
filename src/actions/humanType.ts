import { Page, ElementHandle, KeyInput } from 'puppeteer'

const DEFAULT_WPM = 40
const SENTENCE_ENDINGS = ['.', '!', '?']
const PUNCTUATION_DELAY = 200
const ASCII_MULTIPLIER = 2

// Calculates the typing delay for each character based on the given WPM.
function getDelayForCharacter(char: string, previousChar: string, wpm: number): number {
    const averageDelayPerChar = getAverageDelayPerChar(wpm)

    let delay = averageDelayPerChar

    if (previousChar) {
        const diff = Math.abs(char.charCodeAt(0) - previousChar.charCodeAt(0))
        delay += diff * ASCII_MULTIPLIER
    }

    if (SENTENCE_ENDINGS.includes(char)) {
        delay += PUNCTUATION_DELAY
    }

    return delay
}

// Gets the average delay for each character to type based on WPM.
function getAverageDelayPerChar(wpm: number): number {
    const charsPerMinute = wpm * 5
    return 60000 / charsPerMinute // 60000 ms in a minute
}

// Types a character and waits for a delay.
async function typeCharacter(page: Page, char: string, delay: number): Promise<void> {
    await page.keyboard.press(char as KeyInput)
    await new Promise((res) => setTimeout(res, delay))
}

export async function humanType(
    text: string,
    wpm: number = DEFAULT_WPM,
    page: Page
): Promise<void> {
    if (!page) {
        throw new Error('Page is not initialized. Call launch() first.')
    }

    let previousChar = ''

    for (const char of text) {
        const delay = getDelayForCharacter(char, previousChar, wpm)
        await typeCharacter(page, char, delay)
        previousChar = char
    }
}
