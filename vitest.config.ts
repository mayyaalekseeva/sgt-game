import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts: cloudflare() starts its own dev server, which clashes
// with Vitest's. Domain and worker helper tests are pure and need no plugins.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
