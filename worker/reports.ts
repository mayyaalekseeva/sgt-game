import { METHODS, ROASTS, TASTES, type reports } from './db/schema'

// A report as the client stores it (src/data.ts Report); `yield` is yield_g in the table
export interface ReportIn {
  id: string
  ts: number
  method: (typeof METHODS)[number]
  roast: (typeof ROASTS)[number]
  dose: number
  yield: number
  time: number
  taste: (typeof TASTES)[number]
  diag: string
  recipeVersionId: string | null
}

export const MAX_BATCH = 200

// Client ids: older builds made 8-char base36 ids, newer ones crypto.randomUUID()
const ID = /^[A-Za-z0-9_-]{1,64}$/
const VERSION_ID = /^[a-z]+-[a-z]+@[1-9]\d*$/
const EARLIEST_TS = Date.UTC(2024, 0, 1)
const DAY = 24 * 60 * 60 * 1000

const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && isNum(v, min, max)
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T)

export const isReportId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)

/**
 * Validates a POST /api/reports body: { reports: [...], imported?: boolean }.
 * Bounds are wider than the Diagnose steppers so reports from older builds still import.
 */
export function parseReportBatch(
  body: unknown,
  now = Date.now(),
): { reports: ReportIn[]; imported: boolean } | { error: string } {
  const { reports, imported = false } = (body ?? {}) as { reports?: unknown; imported?: unknown }
  if (!Array.isArray(reports)) return { error: 'expected { reports: [...] }' }
  if (reports.length === 0 || reports.length > MAX_BATCH) return { error: `send 1 to ${MAX_BATCH} reports` }
  if (typeof imported !== 'boolean') return { error: 'imported must be a boolean' }
  const out: ReportIn[] = []
  for (const [i, r] of (reports as Record<string, unknown>[]).entries()) {
    const at = `reports[${i}]`
    if (typeof r !== 'object' || r === null) return { error: `${at}: expected an object` }
    if (!isReportId(r.id)) return { error: `${at}.id is invalid` }
    if (!isInt(r.ts, EARLIEST_TS, now + DAY)) return { error: `${at}.ts is out of range` }
    if (!oneOf(METHODS, r.method)) return { error: `${at}.method is invalid` }
    if (!oneOf(ROASTS, r.roast)) return { error: `${at}.roast is invalid` }
    if (!isNum(r.dose, 0.1, 100)) return { error: `${at}.dose is out of range` }
    if (!isNum(r.yield, 0.1, 2000)) return { error: `${at}.yield is out of range` }
    if (!isInt(r.time, 0, 3600)) return { error: `${at}.time is out of range` }
    if (!oneOf(TASTES, r.taste)) return { error: `${at}.taste is invalid` }
    if (typeof r.diag !== 'string' || r.diag.length === 0 || r.diag.length > 64) return { error: `${at}.diag is invalid` }
    if (r.recipeVersionId != null && (typeof r.recipeVersionId !== 'string' || !VERSION_ID.test(r.recipeVersionId))) {
      return { error: `${at}.recipeVersionId is invalid` }
    }
    out.push({
      id: r.id,
      ts: r.ts,
      method: r.method,
      roast: r.roast,
      dose: r.dose,
      yield: r.yield,
      time: r.time,
      taste: r.taste,
      diag: r.diag,
      recipeVersionId: (r.recipeVersionId as string | null | undefined) ?? null,
    })
  }
  return { reports: out, imported }
}

/**
 * Rows to insert. A version the database does not know (seed not run yet) is stored as null rather
 * than rejected: the foreign key would fail the whole batch, and the client would retry it forever.
 */
export function toReportRows(
  batch: ReportIn[],
  ctx: { userId: string; knownVersions: Set<string>; imported: boolean; now: number },
): (typeof reports.$inferInsert)[] {
  return batch.map(({ yield: yieldG, recipeVersionId, ...r }) => ({
    ...r,
    yieldG,
    recipeVersionId: recipeVersionId && ctx.knownVersions.has(recipeVersionId) ? recipeVersionId : null,
    userId: ctx.userId,
    importedAt: ctx.imported ? ctx.now : null,
    createdAt: ctx.now,
  }))
}

// GET /api/reports row -> the client's Report (src/data.ts parseReportsResponse)
export function toReportOut(r: typeof reports.$inferSelect) {
  return {
    id: r.id,
    ts: r.ts,
    method: r.method,
    roast: r.roast,
    dose: r.dose,
    yield: r.yieldG,
    time: r.time,
    taste: r.taste,
    diag: r.diag,
    recipeVersionId: r.recipeVersionId,
  }
}
