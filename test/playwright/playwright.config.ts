import { defineConfig } from '@playwright/test'

// The test fixture's own tests (`pnpm test:fixture`). Everything else runs in Vitest.
export default defineConfig({
    testDir: '.',
    reporter: 'line',
    timeout: 60_000,
})
