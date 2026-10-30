import { and, asc, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireUser } from './auth'
import { auth } from './auth-routes'
import { db } from './db/client'
import { logError } from './log'
import { coffees, recipes, recipeVersions, reports, workingRecipes } from './db/schema'
import { parseCoffeeBatch, toCoffeeOut, toCoffeeRow, workingKey } from './coffees'
import { toRecipeContent } from './recipes'
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_USER,
  disallowedSegment,
  etagMatches,
  isNonce,
  newNonce,
  nonceOf,
  photoEtag,
  photoKey,
} from './photos'
import { isReportId, parseReportBatch, toReportOut, toReportRows } from './reports'

export const app = new Hono<{ Bindings: Env }>().basePath('/api')

// _headers only applies to static assets, so API responses set their own. Photos set their own caching.
app.use(async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store')
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

const invalid = (message: string) => ({ error: { code: 'invalid', message } })
const reportNotFound = { error: { code: 'not_found', message: 'Report not found' } }

// The report's current photo key: undefined when the report is not the caller's, null when it has no photo
async function currentPhotoKey(env: Env, userId: string, reportId: string) {
  const [row] = await db(env)
    .select({ photoKey: reports.photoKey })
    .from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.id, reportId)))
  return row ? row.photoKey : undefined
}

// Adds or replaces a report's photo. The body is the JPEG itself, already resized and stripped by the client.
// A new key per upload: the old object is deleted only once the report points at the new one.
app.put('/reports/:id/photo', requireUser, async (c) => {
  const reportId = c.req.param('id')
  if (!isReportId(reportId)) return c.json(invalid('report id is invalid'), 400)
  if (c.req.header('Content-Type')?.split(';')[0].trim() !== 'image/jpeg') {
    return c.json({ error: { code: 'unsupported', message: 'Send image/jpeg' } }, 415)
  }
  const length = Number(c.req.header('Content-Length'))
  if (!Number.isInteger(length) || length <= 0) return c.json({ error: { code: 'length_required', message: 'Content-Length required' } }, 411)
  const tooLarge = { error: { code: 'too_large', message: `Photos are at most ${MAX_PHOTO_BYTES} bytes` } }
  if (length > MAX_PHOTO_BYTES) return c.json(tooLarge, 413)
  const bytes = new Uint8Array(await c.req.arrayBuffer())
  if (bytes.length > MAX_PHOTO_BYTES) return c.json(tooLarge, 413)
  const refused = disallowedSegment(bytes)
  if (refused) return c.json(invalid(refused), 400)

  const userId = c.var.userId
  const old = await currentPhotoKey(c.env, userId, reportId)
  if (old === undefined) return c.json(reportNotFound, 404)
  const d = db(c.env)
  if (old === null) {
    const [row] = await d
      .select({ n: count() })
      .from(reports)
      .where(and(eq(reports.userId, userId), isNotNull(reports.photoKey)))
    if (row.n >= MAX_PHOTOS_PER_USER) {
      return c.json({ error: { code: 'photo_limit', message: `At most ${MAX_PHOTOS_PER_USER} photos` } }, 403)
    }
  }

  const nonce = newNonce()
  const key = photoKey(userId, reportId, nonce)
  await c.env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } })
  const updated = await d
    .update(reports)
    .set({ photoKey: key })
    .where(and(eq(reports.userId, userId), eq(reports.id, reportId), old === null ? isNull(reports.photoKey) : eq(reports.photoKey, old)))
    .returning({ id: reports.id })
  if (updated.length === 0) {
    // Another upload or removal got there first; keep theirs
    c.executionCtx.waitUntil(c.env.PHOTOS.delete(key))
    return c.json({ error: { code: 'conflict', message: 'The photo changed meanwhile' } }, 409)
  }
  if (old) c.executionCtx.waitUntil(c.env.PHOTOS.delete(old).catch((err) => logError('photo.delete', err)))
  return c.json({ photo: nonce })
})

app.delete('/reports/:id/photo', requireUser, async (c) => {
  const reportId = c.req.param('id')
  if (!isReportId(reportId)) return c.json(invalid('report id is invalid'), 400)
  const old = await currentPhotoKey(c.env, c.var.userId, reportId)
  if (old === undefined) return c.json(reportNotFound, 404)
  if (old === null) return c.body(null, 204)
  const updated = await db(c.env)
    .update(reports)
    .set({ photoKey: null })
    .where(and(eq(reports.userId, c.var.userId), eq(reports.id, reportId), eq(reports.photoKey, old)))
    .returning({ id: reports.id })
  if (updated.length === 0) return c.json({ error: { code: 'conflict', message: 'The photo changed meanwhile' } }, 409)
  c.executionCtx.waitUntil(c.env.PHOTOS.delete(old).catch((err) => logError('photo.delete', err)))
  return c.body(null, 204)
})

// Only the owner, and only the current photo: an old nonce is 404, so a replaced photo stops being served.
// The URL changes with every upload, so the browser may keep it for good.
app.get('/reports/:id/photo/:nonce', requireUser, async (c) => {
  const { id: reportId, nonce } = c.req.param()
  if (!isReportId(reportId) || !isNonce(nonce)) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404)
  const key = await currentPhotoKey(c.env, c.var.userId, reportId)
  if (!key || nonceOf(key) !== nonce) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404)
  const etag = photoEtag(nonce)
  const headers = {
    'Cache-Control': 'private, max-age=31536000, immutable',
    ETag: etag,
    'Content-Type': 'image/jpeg',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'",
  }
  if (etagMatches(c.req.header('If-None-Match'), etag)) return c.body(null, 304, headers)
  const object = await c.env.PHOTOS.get(key)
  if (!object) {
    logError('photo.missing', new Error('R2 object missing'), { reportId })
    return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404)
  }
  return c.body(object.body, 200, { ...headers, 'Content-Length': String(object.size) })
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
