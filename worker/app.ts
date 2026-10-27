import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireUser } from './auth'
import { auth } from './auth-routes'
import { db } from './db/client'
import { logError } from './log'
import { recipes, recipeVersions, reports, workingRecipes } from './db/schema'
import { toRecipeContent } from './recipes'
import { isReportId, parseReportBatch, toReportOut, toReportRows } from './reports'

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
    logError('health.db', err)
    return c.json({ ok: false, db: { ok: false } }, 503)
  }
})

app.route('/', auth)

// Public: every recipe with all its versions, archived ones included
app.get('/recipes', async (c) => {
  const d = db(c.env)
  const [rows, versions] = await Promise.all([
    d.select().from(recipes).orderBy(asc(recipes.slug)),
    d.select().from(recipeVersions),
  ])
  return c.json(toRecipeContent(rows, versions))
})

// Everything the client needs to rebuild progress: XP, rank and missions are derived from it there
app.get('/reports', requireUser, async (c) => {
  const d = db(c.env)
  const userId = c.var.userId
  const [rows, working] = await d.batch([
    d.select().from(reports).where(eq(reports.userId, userId)).orderBy(desc(reports.ts)),
    d.select().from(workingRecipes).where(eq(workingRecipes.userId, userId)),
  ])
  return c.json({
    reports: rows.map(toReportOut),
    working: Object.fromEntries(working.map((w) => [w.recipeSlug, w.reportId])),
  })
})

// D1 binds at most 100 parameters per statement, and a report row takes 13
const ROWS_PER_INSERT = 7

// Ids come from the client, so a repeated or retried report is ignored: never duplicated, never overwritten.
// `imported: true` marks reports brought over from this browser at first sign-in.
app.post('/reports', requireUser, async (c) => {
  const parsed = parseReportBatch(await c.req.json().catch(() => null))
  if ('error' in parsed) return c.json({ error: { code: 'invalid', message: parsed.error } }, 400)
  const d = db(c.env)
  const known = await d.select({ id: recipeVersions.id }).from(recipeVersions)
  const rows = toReportRows(parsed.reports, {
    userId: c.var.userId,
    knownVersions: new Set(known.map((v) => v.id)),
    imported: parsed.imported,
    now: Date.now(),
  })
  const inserts = []
  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    inserts.push(
      d.insert(reports).values(rows.slice(i, i + ROWS_PER_INSERT)).onConflictDoNothing().returning({ id: reports.id }),
    )
  }
  const [first, ...rest] = inserts
  const results = await d.batch([first, ...rest])
  return c.json({ saved: results.reduce((n, r) => n + r.length, 0) })
})

// A report is the working recipe for its own method and roast, so the slug comes from the report
app.put('/working-recipes', requireUser, async (c) => {
  const { reportId } = ((await c.req.json().catch(() => null)) ?? {}) as { reportId?: unknown }
  if (!isReportId(reportId)) return c.json({ error: { code: 'invalid', message: 'reportId is invalid' } }, 400)
  const d = db(c.env)
  const userId = c.var.userId
  const [report] = await d
    .select({ method: reports.method, roast: reports.roast })
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.id, reportId)))
  if (!report) return c.json({ error: { code: 'not_found', message: 'Report not found' } }, 404)
  const recipeSlug = `${report.method}-${report.roast}`
  const now = Date.now()
  await d
    .insert(workingRecipes)
    .values({ userId, recipeSlug, reportId, updatedAt: now })
    .onConflictDoUpdate({
      target: [workingRecipes.userId, workingRecipes.recipeSlug],
      set: { reportId: sql`excluded.report_id`, updatedAt: now },
    })
  return c.json({ recipeSlug, reportId })
})

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))

app.onError((err, c) => {
  logError('unhandled', err, { method: c.req.method, path: c.req.path })
  return c.json({ error: { code: 'internal', message: 'Internal error' } }, 500)
})
