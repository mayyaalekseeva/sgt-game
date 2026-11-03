import { CUPPING_STATUSES, type cuppingSamples, type cuppingSessions } from './db/schema'

// A cupping session as the client stores it (src/cuppings.ts CuppingSession). The marks are checked for shape only:
// the client cleans them against its form (src/cupping.ts cleanMarks), so a new form needs no server change.

export interface SampleIn {
  id: string
  lot: string | null
  code: string | null
  form: string
  cupCount: number
  scores: Record<string, number>
  cups: Record<string, boolean[]>
  defects: { kind: string; cups: number; flavor?: string }[]
  flavors: string[] | null
  notes: string | null
}

export interface SessionIn {
  id: string
  day: string
  place: string | null
  protocol: string | null
  blind: boolean
  revealed: boolean
  status: (typeof CUPPING_STATUSES)[number]
  updatedAt: number
  samples: SampleIn[]
}

export const MAX_SESSIONS = 50 // per request
export const MAX_SAMPLES = 12 // per session
const MAX_CUPS = 10
const MAX_ATTRIBUTES = 20
const MAX_DEFECTS = 4
const MAX_PLACE = 60
const MAX_TEXT = 280 // protocol and sample notes, like report notes
const MAX_CODE = 8
const MAX_FLAVORS = 5
const ID = /^[0-9a-f]{32}$/
const LOT = /^([a-z0-9]+(-[a-z0-9]+)*|my:[0-9a-f]{32})$/
const WORD = /^[a-z]+(_[a-z]+)*$/ // a form, attribute or defect kind id
const EARLIEST_TS = Date.UTC(2024, 0, 1)
const DAY = 24 * 60 * 60 * 1000
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
const isFlavorId = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 40 && /^[a-z]+(_[a-z]+)*(\.[a-z]+(_[a-z]+)*)?$/.test(v)
const isWord = (v: unknown): v is string => typeof v === 'string' && v.length <= 30 && WORD.test(v)
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const optText = (v: unknown, max: number) => v == null || v === '' || (typeof v === 'string' && v.length <= max)
const trimmed = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

export const isCuppingId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)

const record = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null

function parseSample(s: unknown, at: string): SampleIn | string {
  const r = record(s)
  if (!r) return `${at}: expected an object`
  if (!isCuppingId(r.id)) return `${at}.id is invalid`
  if (r.lot != null && (typeof r.lot !== 'string' || !LOT.test(r.lot))) return `${at}.lot is invalid`
  if (!optText(r.code, MAX_CODE)) return `${at}.code is invalid`
  if (!isWord(r.form)) return `${at}.form is invalid`
  const m = record(r.marks)
  if (!m) return `${at}.marks is invalid`
  if (!isInt(m.cupCount, 1, MAX_CUPS)) return `${at}.marks.cupCount is invalid`
  const scores = record(m.scores)
  if (!scores || Object.keys(scores).length > MAX_ATTRIBUTES) return `${at}.marks.scores is invalid`
  for (const [k, v] of Object.entries(scores)) {
    if (!isWord(k) || typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) return `${at}.marks.scores.${k} is invalid`
  }
  const cups = record(m.cups)
  if (!cups || Object.keys(cups).length > MAX_ATTRIBUTES) return `${at}.marks.cups is invalid`
  for (const [k, v] of Object.entries(cups)) {
    if (!isWord(k) || !Array.isArray(v) || v.length > MAX_CUPS || !v.every((x) => typeof x === 'boolean')) return `${at}.marks.cups.${k} is invalid`
  }
  if (!Array.isArray(m.defects) || m.defects.length > MAX_DEFECTS) return `${at}.marks.defects is invalid`
  const defects: SampleIn['defects'] = []
  for (const d of m.defects) {
    const x = record(d)
    if (!x || !isWord(x.kind) || !isInt(x.cups, 1, MAX_CUPS) || (x.flavor != null && !isFlavorId(x.flavor))) return `${at}.marks.defects is invalid`
    defects.push({ kind: x.kind, cups: x.cups, ...(typeof x.flavor === 'string' ? { flavor: x.flavor } : {}) })
  }
  const flavors = r.flavors ?? null
  if (flavors !== null && !(Array.isArray(flavors) && flavors.length <= MAX_FLAVORS && flavors.every(isFlavorId) && new Set(flavors).size === flavors.length)) {
    return `${at}.flavors is invalid`
  }
  if (!optText(r.notes, MAX_TEXT)) return `${at}.notes is invalid`
  return {
    id: r.id,
    lot: typeof r.lot === 'string' ? r.lot : null,
    code: trimmed(r.code),
    form: r.form,
    cupCount: m.cupCount,
    scores: scores as Record<string, number>,
    cups: cups as Record<string, boolean[]>,
    defects,
    flavors: flavors && flavors.length ? (flavors as string[]) : null,
    notes: trimmed(r.notes),
  }
}

/** Validates a POST /api/cuppings body: { sessions: [...] }, each with all its samples. */
export function parseCuppingBatch(body: unknown, now = Date.now()): { sessions: SessionIn[] } | { error: string } {
  const list = record(body)?.sessions
  if (!Array.isArray(list)) return { error: 'expected { sessions: [...] }' }
  if (list.length === 0 || list.length > MAX_SESSIONS) return { error: `send 1 to ${MAX_SESSIONS} sessions` }
  const out: SessionIn[] = []
  for (const [i, raw] of list.entries()) {
    const at = `sessions[${i}]`
    const s = record(raw)
    if (!s) return { error: `${at}: expected an object` }
    if (!isCuppingId(s.id)) return { error: `${at}.id is invalid` }
    if (!isDay(s.day)) return { error: `${at}.day must be YYYY-MM-DD` }
    if (!optText(s.place, MAX_PLACE)) return { error: `${at}.place is invalid` }
    if (!optText(s.protocol, MAX_TEXT)) return { error: `${at}.protocol is invalid` }
    if (s.blind != null && typeof s.blind !== 'boolean') return { error: `${at}.blind is invalid` }
    if (s.revealed != null && typeof s.revealed !== 'boolean') return { error: `${at}.revealed is invalid` }
    if (!CUPPING_STATUSES.includes(s.status as never)) return { error: `${at}.status is invalid` }
    if (!isInt(s.updatedAt, EARLIEST_TS, now + DAY)) return { error: `${at}.updatedAt is out of range` }
    if (!Array.isArray(s.samples) || s.samples.length > MAX_SAMPLES) return { error: `${at}.samples is invalid` }
    const samples: SampleIn[] = []
    for (const [j, x] of s.samples.entries()) {
      const sample = parseSample(x, `${at}.samples[${j}]`)
      if (typeof sample === 'string') return { error: sample }
      samples.push(sample)
    }
    if (new Set(samples.map((x) => x.id)).size !== samples.length) return { error: `${at}.samples has a repeated id` }
    out.push({
      id: s.id,
      day: s.day,
      place: trimmed(s.place),
      protocol: trimmed(s.protocol),
      blind: s.blind === true,
      revealed: s.revealed === true,
      status: s.status as SessionIn['status'],
      updatedAt: s.updatedAt,
      samples,
    })
  }
  return { sessions: out }
}

export const toSessionRow = (s: SessionIn, userId: string, now: number): typeof cuppingSessions.$inferInsert => ({
  userId,
  id: s.id,
  day: s.day,
  place: s.place,
  protocol: s.protocol,
  blind: s.blind,
  revealed: s.revealed,
  status: s.status,
  updatedAt: s.updatedAt,
  createdAt: now,
})

export const toSampleRows = (s: SessionIn, userId: string): (typeof cuppingSamples.$inferInsert)[] =>
  s.samples.map((x, position) => ({
    userId,
    sessionId: s.id,
    id: x.id,
    position,
    lot: x.lot,
    code: x.code,
    formId: x.form,
    cupCount: x.cupCount,
    scores: x.scores,
    cups: x.cups,
    defects: x.defects,
    flavors: x.flavors,
    notes: x.notes,
  }))

type SessionRow = typeof cuppingSessions.$inferSelect
type SampleRow = typeof cuppingSamples.$inferSelect

// GET /api/reports `cuppings` -> the client's CuppingSession (src/cuppings.ts parseSession). Tombstones go out as
// { id, deleted: true, updatedAt }, so another device drops its copy.
export function toCuppingsOut(sessions: SessionRow[], samples: SampleRow[]) {
  const bySession = new Map<string, SampleRow[]>()
  for (const x of samples) bySession.set(x.sessionId, [...(bySession.get(x.sessionId) ?? []), x])
  return sessions.map((s) => {
    if (s.deletedAt !== null) return { id: s.id, deleted: true, updatedAt: s.updatedAt }
    return {
      id: s.id,
      day: s.day,
      ...(s.place ? { place: s.place } : {}),
      ...(s.protocol ? { protocol: s.protocol } : {}),
      blind: s.blind,
      revealed: s.revealed,
      status: s.status,
      updatedAt: s.updatedAt,
      samples: (bySession.get(s.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((x) => ({
          id: x.id,
          ...(x.lot ? { lot: x.lot } : {}),
          ...(x.code ? { code: x.code } : {}),
          form: x.formId,
          marks: { cupCount: x.cupCount, scores: x.scores, cups: x.cups, defects: x.defects },
          ...(x.flavors?.length ? { flavors: x.flavors } : {}),
          ...(x.notes ? { notes: x.notes } : {}),
        })),
    }
  })
}
