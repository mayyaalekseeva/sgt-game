import { mergeCoffees, parseCoffees, type MyCoffee } from './coffees'
import { MAX_GRINDER, MAX_NOTES, parseReportsResponse, type Report } from './data'
import { isGrinderModel } from './grinders'

// Signed-in sync, kept free of React and fetch so it can be tested. The server is the record; this
// browser keeps a copy of it per account plus an outbox of writes that have not reached it yet.

type Working = Record<string, string> // recipeKey -> report id

// A report's grinder, its setting and notes after filing (worker/reports.ts ReportEdit). A missing field is cleared.
export interface ReportEdit {
  grinder?: string
  grinderModel?: string
  notes?: string
  editedAt: number
}

// What the Diary's edit form sends; empty clears a field
export type EditFields = { grinder?: string; grinderModel?: string; notes?: string }

export interface Outbox {
  reports: Report[]
  working: Working
  coffees?: MyCoffee[] // added or edited coffees; sent before reports, which may name them
  edits?: Record<string, ReportEdit> // report id -> its latest grinder and notes, for reports the server has
  deletes?: string[] // report ids; sent last
}

export interface AccountCache {
  reports: Report[] // as of the last GET /api/reports, plus what has been sent since
  working: Working
  coffees: MyCoffee[]
  outbox: Outbox
  importDecided: boolean // asked once per account and browser whether to import the guest reports
}

export const emptyCache = (): AccountCache => ({ reports: [], working: {}, coffees: [], outbox: { reports: [], working: {} }, importDecided: false })

// Same size as the server's MAX_BATCH (worker/reports.ts)
export const BATCH = 200

export const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

const text = (v: unknown, max: number) => typeof v === 'string' && v.trim() !== '' && v.length <= max

// Queued edits and deletes from localStorage; anything malformed is dropped
function parseChanges(o: Partial<Outbox> | undefined): Pick<Outbox, 'edits' | 'deletes'> {
  const edits: Record<string, ReportEdit> = {}
  for (const [id, e] of Object.entries(o?.edits ?? {})) {
    if (typeof e !== 'object' || e === null || !Number.isFinite(e.editedAt)) continue
    edits[id] = {
      ...(text(e.grinder, MAX_GRINDER) ? { grinder: e.grinder } : {}),
      ...(isGrinderModel(e.grinderModel) ? { grinderModel: e.grinderModel } : {}),
      ...(text(e.notes, MAX_NOTES) ? { notes: e.notes } : {}),
      editedAt: e.editedAt,
    }
  }
  const deletes = Array.isArray(o?.deletes) ? o.deletes.filter((id): id is string => typeof id === 'string') : []
  return { ...(Object.keys(edits).length ? { edits } : {}), ...(deletes.length ? { deletes } : {}) }
}

/** Reads a cache from localStorage; anything unreadable starts over (the server still has it all). */
export function parseAccountCache(raw: unknown): AccountCache {
  try {
    const c = raw as AccountCache
    return {
      ...parseReportsResponse({ reports: c.reports, working: c.working }),
      coffees: parseCoffees(c.coffees),
      outbox: {
        ...parseReportsResponse(c.outbox),
        ...(c.outbox?.coffees?.length ? { coffees: parseCoffees(c.outbox.coffees) } : {}),
        ...parseChanges(c.outbox),
      },
      importDecided: c.importDecided === true,
    }
  } catch {
    return emptyCache()
  }
}

/** The report with its grinder, setting and notes replaced; empty ones are removed. */
export function withEdit(r: Report, e: ReportEdit): Report {
  const { grinder: _grinder, grinderModel: _grinderModel, notes: _notes, ...rest } = r
  return {
    ...rest,
    ...(e.grinder ? { grinder: e.grinder } : {}),
    ...(e.grinderModel ? { grinderModel: e.grinderModel } : {}),
    ...(e.notes ? { notes: e.notes } : {}),
    editedAt: e.editedAt,
  }
}

// The later edit wins, as on the server: a newer one from another device is not undone by an older queued one
const newer = (r: Report, e: ReportEdit | undefined): e is ReportEdit => !!e && !(r.editedAt && r.editedAt > e.editedAt)

const dropWorking = (w: Working, gone: Set<string>) => Object.fromEntries(Object.entries(w).filter(([, id]) => !gone.has(id)))

/**
 * What the screens show: the server's reports plus the ones still waiting to be sent, newest first, with queued
 * edits applied and queued deletes left out.
 */
export function view(c: AccountCache): { reports: Report[]; working: Working; coffees: MyCoffee[] } {
  const ids = new Set(c.reports.map((r) => r.id))
  const gone = new Set(c.outbox.deletes ?? [])
  const edits = c.outbox.edits ?? {}
  const reports = [...c.reports, ...c.outbox.reports.filter((r) => !ids.has(r.id))]
    .filter((r) => !gone.has(r.id))
    .map((r) => (newer(r, edits[r.id]) ? withEdit(r, edits[r.id]) : r))
    .sort((a, b) => b.ts - a.ts)
  return {
    reports,
    working: dropWorking({ ...c.working, ...c.outbox.working }, gone),
    coffees: mergeCoffees(c.coffees, c.outbox.coffees ?? []),
  }
}

/**
 * Queues a new grinder, setting and notes for a report. One still waiting to be sent is changed in place: it goes
 * out with them, and was never filed without them, so it is not marked as edited.
 */
export function queueEdit(c: AccountCache, id: string, fields: EditFields, now: number): AccountCache {
  const edit: ReportEdit = {
    ...(fields.grinder?.trim() ? { grinder: fields.grinder.trim() } : {}),
    ...(isGrinderModel(fields.grinderModel) ? { grinderModel: fields.grinderModel } : {}),
    ...(fields.notes?.trim() ? { notes: fields.notes.trim() } : {}),
    editedAt: now,
  }
  if (c.outbox.reports.some((r) => r.id === id)) {
    const reports = c.outbox.reports.map((r) => {
      if (r.id !== id) return r
      const { editedAt: _editedAt, ...edited } = withEdit(r, edit)
      return edited
    })
    return { ...c, outbox: { ...c.outbox, reports } }
  }
  return { ...c, outbox: { ...c.outbox, edits: { ...c.outbox.edits, [id]: edit } } }
}

/** Queues a delete. Anything still queued for that report is dropped: it would only be sent to be deleted. */
export function queueDelete(c: AccountCache, id: string): AccountCache {
  const { [id]: _edit, ...edits } = c.outbox.edits ?? {}
  return {
    ...c,
    outbox: {
      ...c.outbox,
      reports: c.outbox.reports.filter((r) => r.id !== id),
      working: dropWorking(c.outbox.working, new Set([id])),
      edits,
      deletes: [...(c.outbox.deletes ?? []).filter((x) => x !== id), id],
    },
  }
}

/** A fresh GET /api/reports replaces the copy; the outbox stays, since the server may not have it yet. */
export const withServer = (c: AccountCache, server: { reports: Report[]; working: Working; coffees?: MyCoffee[] }): AccountCache => ({
  ...c,
  ...server,
  coffees: server.coffees ?? c.coffees,
})

export interface Sender {
  postReports: (reports: Report[], imported: boolean) => Promise<void>
  putWorking: (reportId: string) => Promise<void>
  postCoffees: (coffees: MyCoffee[]) => Promise<void>
  patchReport: (id: string, edit: ReportEdit) => Promise<void>
  deleteReport: (id: string) => Promise<void>
}

// The server refused it (400: invalid, 404: report not there). Sending it again would not help.
const refused = (err: unknown) => [400, 404].includes((err as { status?: number }).status ?? 0)

/**
 * Sends the outbox in order: coffees, then reports (which may name a coffee), then edits and working recipes,
 * which need their report on the server, then deletes.
 * Stops at the first failure that might pass on a retry (offline, 5xx, 401) and returns what went
 * through, refused items included so they leave the outbox.
 */
export async function flush(outbox: Outbox, send: Sender): Promise<Outbox> {
  const done: Outbox = { reports: [], working: {} }
  for (const batch of chunks(outbox.coffees ?? [], BATCH)) {
    try {
      await send.postCoffees(batch)
    } catch (err) {
      if (!refused(err)) return done
      console.error('Coffees refused by the server', err)
    }
    done.coffees = [...(done.coffees ?? []), ...batch]
  }
  for (const batch of chunks(outbox.reports, BATCH)) {
    try {
      await send.postReports(batch, false)
    } catch (err) {
      if (!refused(err)) return done
      console.error('Reports refused by the server', err)
    }
    done.reports.push(...batch)
  }
  for (const [id, edit] of Object.entries(outbox.edits ?? {})) {
    try {
      await send.patchReport(id, edit)
    } catch (err) {
      if (!refused(err)) return done
      console.error('Edit refused by the server', err)
    }
    done.edits = { ...done.edits, [id]: edit }
  }
  for (const [key, id] of Object.entries(outbox.working)) {
    try {
      await send.putWorking(id)
    } catch (err) {
      if (!refused(err)) return done
      console.error('Working recipe refused by the server', err)
    }
    done.working[key] = id
  }
  for (const id of outbox.deletes ?? []) {
    try {
      await send.deleteReport(id)
    } catch (err) {
      if (!refused(err)) return done
      console.error('Delete refused by the server', err)
    }
    done.deletes = [...(done.deletes ?? []), id]
  }
  return done
}

/** Moves what flush sent from the outbox into the copy. Writes made while it ran stay queued. */
export function applySent(c: AccountCache, sent: Outbox): AccountCache {
  const ids = new Set(sent.reports.map((r) => r.id))
  const have = new Set(c.reports.map((r) => r.id))
  const working = { ...c.outbox.working }
  for (const [key, id] of Object.entries(sent.working)) if (working[key] === id) delete working[key]
  // a coffee edited again while it was being sent stays queued
  const sentCoffees = sent.coffees ?? []
  const queued = (c.outbox.coffees ?? []).filter((q) => !sentCoffees.some((s) => s.id === q.id && s.updatedAt === q.updatedAt))
  // likewise a report edited again
  const sentEdits = sent.edits ?? {}
  const edits = Object.fromEntries(Object.entries(c.outbox.edits ?? {}).filter(([id, e]) => sentEdits[id]?.editedAt !== e.editedAt))
  const deleted = new Set(sent.deletes ?? [])
  const deletes = (c.outbox.deletes ?? []).filter((id) => !deleted.has(id))
  return {
    ...c,
    coffees: mergeCoffees(c.coffees, sentCoffees),
    reports: [...c.reports, ...sent.reports.filter((r) => !have.has(r.id))]
      .filter((r) => !deleted.has(r.id))
      .map((r) => (newer(r, sentEdits[r.id]) ? withEdit(r, sentEdits[r.id]) : r)),
    working: dropWorking({ ...c.working, ...sent.working }, deleted),
    outbox: {
      reports: c.outbox.reports.filter((r) => !ids.has(r.id)),
      working,
      ...(queued.length ? { coffees: queued } : {}),
      ...(Object.keys(edits).length ? { edits } : {}),
      ...(deletes.length ? { deletes } : {}),
    },
  }
}

/**
 * After a photo upload or removal: the report shows the new photo (or none) wherever it is, the copy or the
 * outbox. Photos are not queued; the server already has this one.
 */
export function withPhoto(c: AccountCache, reportId: string, photo: string | null): AccountCache {
  const set = (rs: Report[]) =>
    rs.map((r) => {
      if (r.id !== reportId) return r
      const { photo: _old, ...rest } = r
      return photo ? { ...rest, photo } : rest
    })
  return { ...c, reports: set(c.reports), outbox: { ...c.outbox, reports: set(c.outbox.reports) } }
}

/**
 * First sign-in: sends this browser's guest coffees, then its reports marked as imported, and its
 * working recipes for the recipes the account has none for yet. Returns what went through, for
 * applySent. Throws if a batch does not go through; sending again is safe, the ids make it a no-op.
 */
export async function importGuest(
  guest: { reports: Report[]; working: Working; coffees?: MyCoffee[] },
  account: Working,
  send: Sender,
): Promise<Outbox> {
  for (const batch of chunks(guest.coffees ?? [], BATCH)) await send.postCoffees(batch)
  for (const batch of chunks(guest.reports, BATCH)) await send.postReports(batch, true)
  const ids = new Set(guest.reports.map((r) => r.id))
  const working: Working = {}
  for (const [key, id] of Object.entries(guest.working)) {
    if (!ids.has(id) || key in account) continue
    try {
      await send.putWorking(id)
      working[key] = id
    } catch (err) {
      if (!refused(err)) throw err
    }
  }
  return { reports: guest.reports, working, ...(guest.coffees?.length ? { coffees: guest.coffees } : {}) }
}

// Not crypto.randomUUID(): it only exists on https and localhost, and the dev server is opened from
// phones over plain http on the LAN
export function newReportId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}
