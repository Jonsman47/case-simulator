import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/simulation/**/*.simulation.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    testTimeout: 120_000,
  },
})
