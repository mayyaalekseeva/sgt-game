import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { deletePhoto, fetchReports, putPhoto, sender, type Source } from './api'
import { useAuth } from './auth'
import { resolvePick, type MyCoffee, type Pick } from './coffees'
import { progressFor, type Report } from './data'
import { useStore } from './store'
import {
  applySent,
  emptyCache,
  flush,
  importGuest,
  newReportId,
  parseAccountCache,
  view,
  withPhoto,
  withServer,
  type AccountCache,
  type Outbox,
} from './sync'

const cacheKey = (userId: string) => `barista-game:account:${userId}`
// Who was signed in last, so a reload shows their progress while /api/me answers
const LAST_USER_KEY = 'barista-game:last-user'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: the outbox lives in memory until the tab closes */
  }
}

interface Account {
  userId: string
  cache: AccountCache
  cached: boolean // the cache came from this browser, so there is something to show before the API answers
  server: 'loading' | 'loaded' | 'failed' // GET /api/reports for this sign-in
}

function openAccount(userId: string): Account {
  const raw = read(cacheKey(userId))
  let cache: AccountCache | null = null
  try {
    if (raw !== null) cache = parseAccountCache(JSON.parse(raw))
  } catch {
    /* unreadable: start over from the server */
  }
  return { userId, cache: cache ?? emptyCache(), cached: cache !== null, server: 'loading' }
}

const pending = (o: Outbox) => o.reports.length > 0 || Object.keys(o.working).length > 0 || (o.coffees?.length ?? 0) > 0

type ImportStatus = 'idle' | 'busy' | 'failed'

interface Reports extends ReturnType<typeof progressFor> {
  source: Source
  loading: boolean // nothing to show yet; reports is empty
  signedIn: boolean
  reports: Report[]
  working: Record<string, string> // working key (src/coffees.ts workingKey) -> report id
  coffees: MyCoffee[] // the player's own coffees, archived ones included
  saveCoffee: (c: MyCoffee) => void
  addReport: (r: Omit<Report, 'id' | 'ts'>) => Report
  markWorking: (key: string, reportId: string) => void
  // Signed in only. Uploads a resized JPEG (src/photo.ts), or removes the photo with null. Throws with .status.
  setPhoto: (reportId: string, jpeg: Blob | null) => Promise<void>
  // This browser's guest reports and coffees, offered to the account once; null when there is nothing to ask
  importOffer: { count: number; status: ImportStatus } | null
  acceptImport: () => void
  declineImport: () => void
}

const Ctx = createContext<Reports | null>(null)

// The reports every screen shows, and XP, rank and missions derived from them.
// Guests: this browser's reports (store.tsx). Signed in: the account's, from GET /api/reports, cached
// per account; new reports and working recipes queue in an outbox until the API has them (sync.ts).
export function ReportsProvider({ children }: { children: ReactNode }) {
  const guest = useStore()
  const { user } = useAuth()
  // Until /api/me answers, assume whoever was signed in last
  const userId = user === undefined ? read(LAST_USER_KEY) : (user?.id ?? null)
  const confirmedId = user?.id ?? null

  const [account, setAccount] = useState<Account | null>(() => (userId ? openAccount(userId) : null))
  if ((account?.userId ?? null) !== userId) setAccount(userId ? openAccount(userId) : null)

  const [reload, setReload] = useState(0)
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle')

  const accountRef = useRef(account)
  useEffect(() => {
    accountRef.current = account
  }, [account])

  useEffect(() => {
    if (user !== undefined) write(LAST_USER_KEY, user?.id ?? null)
  }, [user])

  useEffect(() => {
    if (account) write(cacheKey(account.userId), JSON.stringify(account.cache))
  }, [account])

  const update = useCallback((uid: string, f: (a: Account) => Account) => {
    setAccount((a) => (a && a.userId === uid ? f(a) : a))
  }, [])
  const updateCache = useCallback(
    (uid: string, f: (c: AccountCache) => AccountCache) => update(uid, (a) => ({ ...a, cache: f(a.cache) })),
    [update],
  )

  useEffect(() => {
    if (!confirmedId) return
    const ctrl = new AbortController()
    update(confirmedId, (a) => ({ ...a, server: 'loading' }))
    fetchReports(ctrl.signal).then(
      (server) => update(confirmedId, (a) => ({ ...a, cache: withServer(a.cache, server), server: 'loaded' })),
      (err) => {
        if (ctrl.signal.aborted) return
        console.warn(err)
        update(confirmedId, (a) => ({ ...a, server: 'failed' }))
      },
    )
    return () => ctrl.abort()
  }, [confirmedId, reload, update])

  // One flush at a time. Each change to the outbox triggers another, so writes made during a flush go next.
  const flushing = useRef(false)
  const sync = useCallback(async () => {
    const a = accountRef.current
    if (flushing.current || !a || !pending(a.cache.outbox)) return
    flushing.current = true
    try {
      const sent = await flush(a.cache.outbox, sender)
      // Nothing went through (offline): wait for the next write, the online event or a reload
      if (pending(sent)) updateCache(a.userId, (c) => applySent(c, sent))
    } finally {
      flushing.current = false
    }
  }, [updateCache])

  const outbox = account?.cache.outbox
  useEffect(() => {
    if (confirmedId) void sync()
  }, [confirmedId, outbox, sync])

  useEffect(() => {
    const online = () => void sync()
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [sync])

  const acceptImport = useCallback(async () => {
    const a = accountRef.current
    if (!a) return
    setImportStatus('busy')
    try {
      const sent = await importGuest({ reports: guest.reports, working: guest.working, coffees: guest.coffees }, a.cache.working, sender)
      updateCache(a.userId, (c) => ({ ...applySent(c, sent), importDecided: true }))
      guest.clearGuest()
      setImportStatus('idle')
      setReload((n) => n + 1)
    } catch (err) {
      console.error(err)
      setImportStatus('failed')
    }
  }, [guest, updateCache])

  // Photos are not queued: they need the network now. A report filed a moment ago may still be in the outbox,
  // so a 404 sends it first (a repeat is a no-op on the server) and tries once more.
  const setPhoto = useCallback(
    async (reportId: string, jpeg: Blob | null) => {
      const a = accountRef.current
      if (!a) throw new Error('setPhoto: not signed in')
      let photo: string | null = null
      try {
        if (jpeg) photo = await putPhoto(reportId, jpeg)
        else await deletePhoto(reportId)
      } catch (err) {
        const status = (err as { status?: number }).status
        // read again: a report filed in the same render reaches accountRef only after this started
        const queued = accountRef.current?.cache.outbox.reports.find((r) => r.id === reportId)
        // 409: it changed elsewhere meanwhile; show what the server has now
        if (status === 409) setReload((n) => n + 1)
        if (status !== 404 || !queued || !jpeg) throw err
        await sender.postReports([queued], false)
        photo = await putPhoto(reportId, jpeg)
      }
      updateCache(a.userId, (c) => withPhoto(c, reportId, photo))
    },
    [updateCache],
  )

  const declineImport = useCallback(() => {
    if (account) updateCache(account.userId, (c) => ({ ...c, importDecided: true }))
  }, [account, updateCache])

  const value = useMemo<Reports>(() => {
    const shown = account ? view(account.cache) : { reports: guest.reports, working: guest.working, coffees: guest.coffees }
    const guestItems = guest.reports.length + guest.coffees.length
    // Asked only once the server has answered, so import knows which working recipes the account already has
    const offer =
      account && confirmedId && account.server === 'loaded' && !account.cache.importDecided && guestItems > 0
    return {
      ...shown,
      ...progressFor(shown.reports, shown.working),
      source: account ? 'api' : 'browser',
      loading: account ? !account.cached && account.server === 'loading' : user === undefined,
      signedIn: account !== null,
      addReport: (r) => {
        const report: Report = { ...r, id: newReportId(), ts: Date.now() }
        if (account) updateCache(account.userId, (c) => ({ ...c, outbox: { ...c.outbox, reports: [report, ...c.outbox.reports] } }))
        else guest.addReport(report)
        return report
      },
      markWorking: (key, reportId) => {
        if (account) updateCache(account.userId, (c) => ({ ...c, outbox: { ...c.outbox, working: { ...c.outbox.working, [key]: reportId } } }))
        else guest.markWorking(key, reportId)
      },
      saveCoffee: (c) => {
        if (account) {
          updateCache(account.userId, (x) => ({
            ...x,
            outbox: { ...x.outbox, coffees: [...(x.outbox.coffees ?? []).filter((q) => q.id !== c.id), c] },
          }))
        } else guest.saveCoffee(c)
      },
      setPhoto,
      importOffer: offer ? { count: guestItems, status: importStatus } : null,
      acceptImport: () => void acceptImport(),
      declineImport,
    }
  }, [account, confirmedId, guest, user, importStatus, updateCache, acceptImport, declineImport, setPhoto])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useReports() {
  const v = useContext(Ctx)
  if (!v) throw new Error('ReportsProvider missing')
  return v
}

/** The coffee and recipe the picker adds up to, with the player's coffees taken into account. */
export function usePick(): Pick {
  const { method, roast, brewer, lot } = useStore()
  const { coffees } = useReports()
  return resolvePick({ method, roast, brewer, lot }, coffees)
}
