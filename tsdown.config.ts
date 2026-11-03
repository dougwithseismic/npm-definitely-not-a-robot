import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: { index: 'src/index.ts', playwright: 'src/playwright.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    target: 'node18',
    // Keep the .js/.d.ts names package.json points at (the package is "type": "module").
    fixedExtension: false,
    // Fail the build if the published exports would resolve wrongly for anyone: ESM, CommonJS,
    // or TypeScript's old "node" resolution (tsdown's attw default only warns, and only for ESM).
    publint: true,
    attw: { profile: 'strict', level: 'error' },
})
