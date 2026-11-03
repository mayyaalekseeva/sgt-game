import { SCA_FORM, cleanMarks, emptyMarks, formById, scoreSample, type FormDef, type SampleMarks, type SampleScore } from './cupping'
import { isDay, localDay, MAX_NOTES } from './data'
import { cleanFlavors } from './flavors'

// Cupping sessions: a day's table of coffees, each scored on a form (src/cupping.ts). Synced like coffees: the client
// makes the ids, the newer updatedAt wins, and a deleted id stays deleted (worker/cuppings.ts).

export type CuppingStatus = 'draft' | 'done'

export interface CuppingSample {
  id: string // 32 hex characters, made on the client
  lot?: string // a lot slug or a `my:` coffee ref; none for a coffee not in the app
  code?: string // the blind code on the cup
  form: string // a FormDef id
  marks: SampleMarks
  flavors?: string[] // src/flavors.ts ids
  notes?: string
}

export interface CuppingSession {
  id: string
  day: string // YYYY-MM-DD
  place?: string
  protocol?: string // the player's notes on how it was set up
  blind: boolean
  revealed: boolean // blind names shown; always shown when not blind
  status: CuppingStatus
  updatedAt: number
  samples: CuppingSample[]
}

// Same limits as the server (worker/cuppings.ts)
export const MAX_SAMPLES = 12
export const MAX_PLACE = 60
export const MAX_CODE = 8
export { MAX_NOTES }

const ID = /^[0-9a-f]{32}$/
const LOT = /^([a-z0-9]+(-[a-z0-9]+)*|my:[0-9a-f]{32})$/
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= max

// Marks of a form this build does not know (a newer build added it): kept as they came, if they have the shape, so
// syncing back does not lose them. They are not scored here.
function foreignMarks(v: unknown): SampleMarks | null {
  const m = v as Partial<SampleMarks> | null
  if (!m || typeof m !== 'object' || !Number.isInteger(m.cupCount)) return null
  if (!m.scores || typeof m.scores !== 'object' || !m.cups || typeof m.cups !== 'object' || !Array.isArray(m.defects)) return null
  return { cupCount: m.cupCount as number, scores: m.scores, cups: m.cups, defects: m.defects }
}

/** One sample from storage or the API; null if it does not hold up. */
export function parseSample(raw: unknown): CuppingSample | null {
  const s = raw as Record<string, unknown> | null
  if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !ID.test(s.id)) return null
  if (typeof s.form !== 'string') return null
  const form = formById(s.form)
  const marks = form ? cleanMarks(form, s.marks) : foreignMarks(s.marks)
  if (!marks) return null
  const flavors = cleanFlavors(s.flavors)
  return {
    id: s.id,
    ...(typeof s.lot === 'string' && LOT.test(s.lot) ? { lot: s.lot } : {}),
    ...(text(s.code, MAX_CODE) ? { code: s.code.trim() } : {}),
    form: s.form,
    marks,
    ...(flavors.length ? { flavors } : {}),
    ...(text(s.notes, MAX_NOTES) ? { notes: s.notes.trim() } : {}),
  }
}

/** One session from storage or the API; null if it does not hold up (a server tombstone included). */
export function parseSession(raw: unknown): CuppingSession | null {
  const s = raw as Record<string, unknown> | null
  if (!s || typeof s !== 'object' || s.deleted === true) return null
  if (typeof s.id !== 'string' || !ID.test(s.id) || !isDay(s.day)) return null
  if (typeof s.updatedAt !== 'number' || !Number.isFinite(s.updatedAt)) return null
  const samples = Array.isArray(s.samples) ? s.samples.map(parseSample).filter((x): x is CuppingSample => x !== null) : []
  return {
    id: s.id,
    day: s.day,
    ...(text(s.place, MAX_PLACE) ? { place: s.place.trim() } : {}),
    ...(text(s.protocol, MAX_NOTES) ? { protocol: s.protocol.trim() } : {}),
    blind: s.blind === true,
    revealed: s.revealed === true,
    status: s.status === 'done' ? 'done' : 'draft',
    updatedAt: s.updatedAt,
    samples: samples.slice(0, MAX_SAMPLES),
  }
}

/** A list from storage or the API: bad entries and tombstones are skipped. */
export const parseSessions = (raw: unknown): CuppingSession[] =>
  Array.isArray(raw) ? raw.map(parseSession).filter((s): s is CuppingSession => s !== null) : []

/** Ids the server says are deleted (its tombstones), so a copy queued elsewhere is dropped too. */
export const deletedIds = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? raw.filter((s): s is { id: string } => !!s && typeof s === 'object' && (s as { deleted?: unknown }).deleted === true && typeof (s as { id?: unknown }).id === 'string').map((s) => s.id)
    : []

/** The newer copy of each session wins; newest day first. */
export function mergeSessions(a: CuppingSession[], b: CuppingSession[]): CuppingSession[] {
  const byId = new Map(a.map((s) => [s.id, s]))
  for (const s of b) {
    const have = byId.get(s.id)
    if (!have || s.updatedAt >= have.updatedAt) byId.set(s.id, s)
  }
  return sortSessions([...byId.values()])
}

export const sortSessions = (list: CuppingSession[]) =>
  [...list].sort((x, y) => (x.day === y.day ? y.updatedAt - x.updatedAt : x.day < y.day ? 1 : -1))

export function newSession(id: string, now: number, dayOf: (ts: number) => string = localDay): CuppingSession {
  return { id, day: dayOf(now), blind: false, revealed: false, status: 'draft', updatedAt: now, samples: [] }
}

export function newSample(id: string, form: FormDef = SCA_FORM, cupCount = form.cups): CuppingSample {
  return { id, form: form.id, marks: emptyMarks(form, cupCount) }
}

/** The next blind code: A, B, C... after the ones in use. */
export function nextCode(session: CuppingSession): string {
  const used = new Set(session.samples.map((s) => s.code))
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i)
    if (!used.has(c)) return c
  }
  return String(session.samples.length + 1)
}

/** Whether the coffee's name is hidden: blind and not revealed yet. */
export const namesHidden = (s: CuppingSession) => s.blind && !s.revealed

/**
 * The copy to open: the draft kept in this browser while editing, if it is newer than the synced one. A draft
 * survives a dropped connection or a closed tab before its save went out.
 */
export function pickDraft(saved: CuppingSession | undefined, draft: CuppingSession | null | undefined): CuppingSession | undefined {
  if (draft && (!saved || draft.updatedAt > saved.updatedAt)) return draft
  return saved
}

/** A change, stamped later than the copy it changes even within one millisecond, so the newer copy always wins. */
export const touched = (s: CuppingSession, now: number): CuppingSession => ({ ...s, updatedAt: Math.max(now, s.updatedAt + 1) })

export interface Ranked {
  sample: CuppingSample
  score: SampleScore | null // null for a form this build does not know
}

/** The session's samples for the summary: scored ones by final score, best first; unfinished and unknown ones last. */
export function compareSamples(session: CuppingSession): Ranked[] {
  const rank = (r: Ranked) => (r.score?.complete ? r.score.final : -Infinity)
  return session.samples
    .map((sample) => {
      const form = formById(sample.form)
      return { sample, score: form ? scoreSample(form, sample.marks) : null }
    })
    .sort((a, b) => rank(b) - rank(a))
}
