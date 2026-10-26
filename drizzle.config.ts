import { defineConfig } from 'drizzle-kit'

// Drizzle Kit only generates SQL here. Wrangler applies it (npm run db:migrate:local / :remote),
// so no D1 credentials are needed.
export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/db/schema.ts',
  out: './migrations',
})
