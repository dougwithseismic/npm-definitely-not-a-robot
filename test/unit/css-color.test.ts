import { describe, expect, it } from 'vitest'
import { HumanError, trail, visibleCursor } from '../../src'
import { isCssColor } from '../../src/plugins/css-color'

describe('colour options', () => {
    it('accepts the colours CSS accepts', () => {
        const colors = [
            'tomato',
            'RebeccaPurple',
            'currentColor',
            '#e11d48',
            '#fff8',
            ' #111827 ',
            'rgb(0 0 0 / 50%)',
            'hsl(200deg 50% 40%)',
            'oklch(70% 0.1 200)',
            'var(--brand)',
        ]
        for (const color of colors) expect(isCssColor(color), color).toBe(true)
    })

    it('rejects typos and things that are not colours', () => {
        for (const color of ['blu', '', '#12345', 'rgb', 'rbg(0, 0, 0)', 'red;', 42, null]) {
            expect(isCssColor(color), String(color)).toBe(false)
        }
    })

    it('says which option is wrong when the plugin is created, not when it draws nothing', () => {
        expect(() => visibleCursor({ color: 'blu' })).toThrow(
            'visibleCursor color must be a CSS colour, but got string "blu".'
        )
        expect(() => visibleCursor({ ripple: 'bleu' })).toThrow(HumanError)
        expect(() => trail({ color: '#ggg' })).toThrow(/^trail color/)
    })
})
