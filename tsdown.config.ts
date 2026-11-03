import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    target: 'node18',
    // Keep the .js/.d.ts names package.json points at (the package is "type": "module").
    fixedExtension: false,
    // Fail the build if the published exports would resolve wrongly for anyone.
    publint: true,
    attw: true,
})
