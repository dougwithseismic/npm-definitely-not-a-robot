const CONFIG = {
    GREETING: 'Hello',
    NAME: 'World',
}

const makeGreeting = (greeting: string[]) => {
    return `${greeting}`
}

const greeting = makeGreeting([CONFIG.GREETING, CONFIG.NAME])

export default { greeting }
export * from './types'
