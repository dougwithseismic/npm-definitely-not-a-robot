/**
 * Prepare a function to be serialised and run in the page. Tools that keep function names when
 * compiling (esbuild's `keepNames`, which tsx turns on) wrap inner functions in a `__name()`
 * helper that only exists in Node, so the page would throw "__name is not defined". The page gets
 * the same function with a stand-in for that helper.
 */
export function inPage<F extends (...args: any[]) => unknown>(fn: F): F {
    const source = `function (...args) { const __name = (f) => f; return (${fn}).apply(this, args) }`
    return Object.assign((...args: Parameters<F>) => fn(...args), { toString: () => source }) as F
}
