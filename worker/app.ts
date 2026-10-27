import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireUser } from './auth'
import { auth } from './auth-routes'
import { db } from './db/client'
import { logError } from './log'
import { coffees, recipes, recipeVersions, reports, workingRecipes } from './db/schema'
import { parseCoffeeBatch, toCoffeeOut, toCoffeeRow, workingKey } from './coffees'
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
  const [rows, working, mine] = await d.batch([
    d.select().from(reports).where(eq(reports.userId, userId)).orderBy(desc(reports.ts)),
    d.select().from(workingRecipes).where(eq(workingRecipes.userId, userId)),
    d.select().from(coffees).where(eq(coffees.userId, userId)).orderBy(asc(coffees.updatedAt)),
  ])
  return c.json({
    reports: rows.map(toReportOut),
    working: Object.fromEntries(working.map((w) => [workingKey(w.recipeSlug, w.lot), w.reportId])),
    coffees: mine.map(toCoffeeOut),
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

// A report is the working recipe for its own recipe (method + roast, or filter + brewer) and coffee, so both come
// from the report
app.put('/working-recipes', requireUser, async (c) => {
  const { reportId } = ((await c.req.json().catch(() => null)) ?? {}) as { reportId?: unknown }
  if (!isReportId(reportId)) return c.json({ error: { code: 'invalid', message: 'reportId is invalid' } }, 400)
  const d = db(c.env)
  const userId = c.var.userId
  const [report] = await d
    .select({ method: reports.method, roast: reports.roast, brewer: reports.brewer, lot: reports.lot })
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.id, reportId)))
  if (!report) return c.json({ error: { code: 'not_found', message: 'Report not found' } }, 404)
  const recipeSlug = report.method === 'filter' && report.brewer ? `filter-${report.brewer}` : `${report.method}-${report.roast}`
  const lot = report.lot ?? ''
  const now = Date.now()
  await d
    .insert(workingRecipes)
    .values({ userId, recipeSlug, lot, reportId, updatedAt: now })
    .onConflictDoUpdate({
      target: [workingRecipes.userId, workingRecipes.recipeSlug, workingRecipes.lot],
      set: { reportId: sql`excluded.report_id`, updatedAt: now },
    })
  return c.json({ key: workingKey(recipeSlug, lot), reportId })
})

// D1 binds at most 100 parameters per statement, and a coffee row takes 11
const COFFEES_PER_INSERT = 9

// Adds or updates the player's coffees. An older copy never overwrites a newer one.
app.post('/coffees', requireUser, async (c) => {
  const parsed = parseCoffeeBatch(await c.req.json().catch(() => null))
  if ('error' in parsed) return c.json({ error: { code: 'invalid', message: parsed.error } }, 400)
  const d = db(c.env)
  const now = Date.now()
  const rows = parsed.coffees.map((x) => toCoffeeRow(x, c.var.userId, now))
  const writes = []
  for (let i = 0; i < rows.length; i += COFFEES_PER_INSERT) {
    writes.push(
      d
        .insert(coffees)
        .values(rows.slice(i, i + COFFEES_PER_INSERT))
        .onConflictDoUpdate({
          target: [coffees.userId, coffees.id],
          set: {
            roaster: sql`excluded.roaster`,
            origin: sql`excluded.origin`,
            process: sql`excluded.process`,
            roast: sql`excluded.roast`,
            name: sql`excluded.name`,
            archived: sql`excluded.archived`,
            roastedOn: sql`excluded.roasted_on`,
            updatedAt: sql`excluded.updated_at`,
          },
          setWhere: sql`excluded.updated_at >= ${coffees.updatedAt}`,
        }),
    )
  }
  const [first, ...rest] = writes
  await d.batch([first, ...rest])
  return c.json({ saved: rows.length })
})

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))

app.onError((err, c) => {
  logError('unhandled', err, { method: c.req.method, path: c.req.path })
  return c.json({ error: { code: 'internal', message: 'Internal error' } }, 500)
})
