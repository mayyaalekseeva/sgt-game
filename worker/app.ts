import { count } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from './db/client'
import { recipeVersions } from './db/schema'

export const app = new Hono<{ Bindings: Env }>().basePath('/api')

// _headers only applies to static assets, so API responses set their own
app.use(async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Cache-Control', 'no-store')
})

// db.recipeVersions is 0 until migrations and the recipe seed have run
app.get('/health', async (c) => {
  try {
    const [row] = await db(c.env).select({ n: count() }).from(recipeVersions)
    return c.json({ ok: true, db: { ok: true, recipeVersions: row.n } })
  } catch (err) {
    console.error(err)
    return c.json({ ok: false, db: { ok: false } }, 503)
  }
})

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: { code: 'internal', message: 'Internal error' } }, 500)
})
