export type HumanErrorCode =
    | 'UNSUPPORTED_PAGE'
    | 'UNSUPPORTED_TARGET'
    | 'TARGET_NOT_FOUND'
    | 'TARGET_NOT_VISIBLE'
    | 'TARGET_COVERED'
    | 'TARGET_AMBIGUOUS'
    | 'INVALID_OPTION'

/**
 * Every error the library throws on purpose. `code` is stable for programs to check; the message
 * says what happened and the `hint` says what to do about it.
 */
export class HumanError extends Error {
    readonly code: HumanErrorCode
    readonly hint?: string

    constructor(code: HumanErrorCode, message: string, hint?: string) {
        super(hint ? `${message}\n  → ${hint}` : message)
        this.name = 'HumanError'
        this.code = code
        this.hint = hint
    }
}

/** Throw `INVALID_OPTION` with `message` and `hint` unless `ok`. */
export function requireOption(ok: unknown, message: string, hint: string): asserts ok {
    if (!ok) throw new HumanError('INVALID_OPTION', message, hint)
}

/** A short description of an unexpected value for error messages. */
export function describeValue(value: unknown): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'function') return 'a function'
    if (typeof value !== 'object') return `${typeof value} ${JSON.stringify(value)}`
    if (Array.isArray(value)) return 'an array'
    // Bundlers rename classes (Browser → Browser2), so trim trailing digits.
    const name = value.constructor?.name?.replace(/\d+$/, '')
    if (name && name !== 'Object') return `a ${name}`
    const keys = Object.keys(value).filter((key) => !key.startsWith('_'))
    return keys.length ? `an object with keys ${keys.slice(0, 5).join(', ')}` : 'an empty object'
}
