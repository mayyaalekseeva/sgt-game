import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadReports, type Source } from './api'
import { useAuth } from './auth'
import type { Report } from './data'
import { useStore } from './store'

interface Reports {
  source: Source
  reports: Report[]
  working: Record<string, string> // recipeKey -> report id
}

type Remote = { reports: Report[]; working: Record<string, string> }

const Ctx = createContext<Reports | null | undefined>(undefined)

// The reports Profile, Diary and Saved recipes show. Signed-in users: GET /api/reports, loaded once per
// sign-in. Guests (and the API failing): this browser's reports, live from the store.
export function ReportsProvider({ children }: { children: ReactNode }) {
  const { reports, working } = useStore()
  const { user } = useAuth()
  // undefined while loading, null when the browser is the source
  const [remote, setRemote] = useState<Remote | null | undefined>(undefined)
  const userId = user === undefined ? undefined : (user?.id ?? null)

  useEffect(() => {
    if (userId === undefined) return
    if (userId === null) {
      setRemote(null)
      return
    }
    const ctrl = new AbortController()
    setRemote(undefined)
    loadReports(ctrl.signal, { reports: [], working: {} }).then(
      (r) => setRemote(r.source === 'api' ? r : null),
      () => {}, // aborted
    )
    return () => ctrl.abort()
  }, [userId])

  const value: Reports | null = remote === undefined ? null : remote ? { source: 'api', ...remote } : { source: 'browser', reports, working }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// null while loading
export function useReports() {
  const v = useContext(Ctx)
  if (v === undefined) throw new Error('ReportsProvider missing')
  return v
}
