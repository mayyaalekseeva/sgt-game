import { parseReportsResponse, type Report } from './data'

// Signed-in sync, kept free of React and fetch so it can be tested. The server is the record; this
// browser keeps a copy of it per account plus an outbox of writes that have not reached it yet.

type Working = Record<string, string> // recipeKey -> report id

export interface Outbox {
  reports: Report[]
  working: Working
}

export interface AccountCache {
  reports: Report[] // as of the last GET /api/reports, plus what has been sent since
  working: Working
  outbox: Outbox
  importDecided: boolean // asked once per account and browser whether to import the guest reports
}

export const emptyCache = (): AccountCache => ({ reports: [], working: {}, outbox: { reports: [], working: {} }, importDecided: false })

// Same size as the server's MAX_BATCH (worker/reports.ts)
export const BATCH = 200

export const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

/** Reads a cache from localStorage; anything unreadable starts over (the server still has it all). */
export function parseAccountCache(raw: unknown): AccountCache {
  try {
    const c = raw as AccountCache
    return {
      ...parseReportsResponse({ reports: c.reports, working: c.working }),
      outbox: parseReportsResponse(c.outbox),
      importDecided: c.importDecided === true,
    }
  } catch {
    return emptyCache()
  }
}

/** What the screens show: the server's reports plus the ones still waiting to be sent, newest first. */
export function view(c: AccountCache): { reports: Report[]; working: Working } {
  const ids = new Set(c.reports.map((r) => r.id))
  const reports = [...c.reports, ...c.outbox.reports.filter((r) => !ids.has(r.id))].sort((a, b) => b.ts - a.ts)
  return { reports, working: { ...c.working, ...c.outbox.working } }
}

/** A fresh GET /api/reports replaces the copy; the outbox stays, since the server may not have it yet. */
export const withServer = (c: AccountCache, server: { reports: Report[]; working: Working }): AccountCache => ({ ...c, ...server })

export interface Sender {
  postReports: (reports: Report[], imported: boolean) => Promise<void>
  putWorking: (reportId: string) => Promise<void>
}

// The server refused it (400: invalid, 404: report not there). Sending it again would not help.
const refused = (err: unknown) => [400, 404].includes((err as { status?: number }).status ?? 0)

/**
 * Sends the outbox in order: reports first, since a working recipe needs its report on the server.
 * Stops at the first failure that might pass on a retry (offline, 5xx, 401) and returns what went
 * through, refused items included so they leave the outbox.
 */
export async function flush(outbox: Outbox, send: Sender): Promise<Outbox> {
  const done: Outbox = { reports: [], working: {} }
  for (const batch of chunks(outbox.reports, BATCH)) {
    try {
      await send.postReports(batch, false)
    } catch (err) {
      if (!refused(err)) return done
      console.error('Reports refused by the server', err)
    }
    done.reports.push(...batch)
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
  return done
}

/** Moves what flush sent from the outbox into the copy. Writes made while it ran stay queued. */
export function applySent(c: AccountCache, sent: Outbox): AccountCache {
  const ids = new Set(sent.reports.map((r) => r.id))
  const have = new Set(c.reports.map((r) => r.id))
  const working = { ...c.outbox.working }
  for (const [key, id] of Object.entries(sent.working)) if (working[key] === id) delete working[key]
  return {
    ...c,
    reports: [...c.reports, ...sent.reports.filter((r) => !have.has(r.id))],
    working: { ...c.working, ...sent.working },
    outbox: { reports: c.outbox.reports.filter((r) => !ids.has(r.id)), working },
  }
}

/**
 * First sign-in: sends this browser's guest reports to the account, marked as imported, and its
 * working recipes for the recipes the account has none for yet. Returns what went through, for
 * applySent. Throws if a batch does not go through; sending again is safe, the ids make it a no-op.
 */
export async function importGuest(guest: { reports: Report[]; working: Working }, account: Working, send: Sender): Promise<Outbox> {
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
  return { reports: guest.reports, working }
}

// Not crypto.randomUUID(): it only exists on https and localhost, and the dev server is opened from
// phones over plain http on the LAN
export function newReportId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}
