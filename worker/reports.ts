import { BREWERS, METHODS, ROASTS, TASTES, type reports } from './db/schema'
import { nonceOf } from './photos'

// A report as the client stores it (src/data.ts Report); `yield` is yield_g in the table
export interface ReportIn {
  id: string
  ts: number
  method: (typeof METHODS)[number]
  roast: (typeof ROASTS)[number] | null
  brewer: (typeof BREWERS)[number] | null
  dose: number
  yield: number
  time: number
  taste: (typeof TASTES)[number]
  diag: string
  recipeVersionId: string | null
  lot: string | null
  grinder: string | null
  notes: string | null
  timed: boolean
}

export const MAX_BATCH = 200

// Client ids: older builds made 8-char base36 ids, newer ones crypto.randomUUID()
const ID = /^[A-Za-z0-9_-]{1,64}$/
const VERSION_ID = /^[a-z]+-[a-z0-9]+@[1-9]\d*$/
// A roaster lot slug, or one of the player's coffees: my:<32 hex>
const LOT = /^([a-z0-9]+(-[a-z0-9]+)*|my:[0-9a-f]{32})$/
// Same limits as the client (src/data.ts MAX_GRINDER, MAX_NOTES)
const MAX_GRINDER = 30
const MAX_NOTES = 280
const EARLIEST_TS = Date.UTC(2024, 0, 1)
const DAY = 24 * 60 * 60 * 1000

const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && isNum(v, min, max)
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T)

export const isReportId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)

// Espresso has a roast; filter a brewer, or a roast on reports from before brewers (as src/data.ts isBrew)
function brewOf(r: Record<string, unknown>): Pick<ReportIn, 'roast' | 'brewer'> | null {
  const roast = r.roast ?? null
  const brewer = r.brewer ?? null
  if (roast !== null && !oneOf(ROASTS, roast)) return null
  if (brewer !== null && !oneOf(BREWERS, brewer)) return null
  const ok = r.method === 'espresso' ? roast !== null && brewer === null : roast !== null || brewer !== null
  return ok ? { roast, brewer } : null
}

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
    const brew = brewOf(r)
    if (!brew) return { error: `${at}: roast or brewer is invalid for ${r.method}` }
    if (!isNum(r.dose, 0.1, 100)) return { error: `${at}.dose is out of range` }
    if (!isNum(r.yield, 0.1, 2000)) return { error: `${at}.yield is out of range` }
    if (!isInt(r.time, 0, 3600)) return { error: `${at}.time is out of range` }
    if (!oneOf(TASTES, r.taste)) return { error: `${at}.taste is invalid` }
    if (typeof r.diag !== 'string' || r.diag.length === 0 || r.diag.length > 64) return { error: `${at}.diag is invalid` }
    if (r.recipeVersionId != null && (typeof r.recipeVersionId !== 'string' || !VERSION_ID.test(r.recipeVersionId))) {
      return { error: `${at}.recipeVersionId is invalid` }
    }
    if (r.lot != null && (typeof r.lot !== 'string' || r.lot.length > 64 || !LOT.test(r.lot))) return { error: `${at}.lot is invalid` }
    if (r.grinder != null && (typeof r.grinder !== 'string' || r.grinder.length > MAX_GRINDER)) return { error: `${at}.grinder is invalid` }
    if (r.notes != null && (typeof r.notes !== 'string' || r.notes.length > MAX_NOTES)) return { error: `${at}.notes is invalid` }
    if (r.timed != null && typeof r.timed !== 'boolean') return { error: `${at}.timed is invalid` }
    out.push({
      id: r.id,
      ts: r.ts,
      method: r.method,
      ...brew,
      dose: r.dose,
      yield: r.yield,
      time: r.time,
      taste: r.taste,
      diag: r.diag,
      recipeVersionId: (r.recipeVersionId as string | null | undefined) ?? null,
      lot: (r.lot as string | null | undefined) ?? null,
      grinder: (r.grinder as string | null | undefined) || null,
      notes: (r.notes as string | null | undefined) || null,
      timed: r.timed === true,
    })
  }
  return { reports: out, imported }
}

// The only fields that change after filing: the player's own words. The numbers, taste and diagnosis stay as filed.
export interface ReportEdit {
  grinder: string | null
  notes: string | null
  editedAt: number
}

/** Validates a PATCH /api/reports/:id body: { grinder, notes, editedAt }. Empty text clears the field. */
export function parseReportEdit(body: unknown, now = Date.now()): ReportEdit | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'expected { grinder, notes, editedAt }' }
  const { grinder, notes, editedAt } = body as Record<string, unknown>
  if (grinder != null && (typeof grinder !== 'string' || grinder.length > MAX_GRINDER)) return { error: 'grinder is invalid' }
  if (notes != null && (typeof notes !== 'string' || notes.length > MAX_NOTES)) return { error: 'notes is invalid' }
  if (!isInt(editedAt, EARLIEST_TS, now + DAY)) return { error: 'editedAt is out of range' }
  return { grinder: (grinder as string | null | undefined)?.trim() || null, notes: (notes as string | null | undefined)?.trim() || null, editedAt }
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
  const photo = nonceOf(r.photoKey)
  return {
    id: r.id,
    ts: r.ts,
    method: r.method,
    roast: r.roast,
    brewer: r.brewer,
    dose: r.dose,
    yield: r.yieldG,
    time: r.time,
    taste: r.taste,
    diag: r.diag,
    recipeVersionId: r.recipeVersionId,
    lot: r.lot,
    grinder: r.grinder,
    notes: r.notes,
    ...(r.timed ? { timed: true } : {}),
    ...(photo ? { photo } : {}),
    ...(r.editedAt ? { editedAt: r.editedAt } : {}),
  }
}
