import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BREWERS, brewOf, slugOf, type Brew, type Brewer, type Lang, type Method, type Report, type Roast } from './data'
import { translate, type Key } from './i18n'
import { lotBySlug } from './lots'

const STORAGE_KEY = 'barista-game:v1'

interface Persisted {
  lang: Lang
  method: Method
  roast: Roast // espresso
  brewer: Brewer // filter
  lot: string | null // coffee lot slug; null for another coffee
  reports: Report[]
  working: Record<string, string> // recipe slug -> report id
}

const initial = (): Persisted => ({
  lang: navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en',
  method: 'espresso',
  roast: 'medium',
  brewer: 'v60',
  lot: null,
  reports: [],
  working: {},
})

function load(): Persisted {
  const base = initial()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = { ...base, ...JSON.parse(raw) } as Persisted
      // saved before brewers existed
      // saved before brewers or lots existed, or the lot left the content file
      return {
        ...saved,
        brewer: BREWERS.includes(saved.brewer) ? saved.brewer : base.brewer,
        lot: lotBySlug(saved.lot) ? saved.lot : null,
      }
    }
  } catch {
    /* storage unavailable: run in memory */
  }
  return base
}

// Settings, plus the guest's reports and working recipes. Screens read reports through useReports
// (reports.tsx), which picks these or the signed-in account's.
interface Store extends Persisted {
  t: (key: Key, vars?: Record<string, string | number>) => string
  setLang: (l: Lang) => void
  setMethod: (m: Method) => void
  setRoast: (r: Roast) => void
  setBrewer: (b: Brewer) => void
  setLot: (lot: string | null) => void
  brew: Brew // the picked recipe: espresso + roast or filter + brewer
  slug: string
  addReport: (r: Report) => void
  markWorking: (key: string, reportId: string) => void
  reset: () => void
  // Brew timer, kept in memory only: it survives switching tabs, not a reload
  timer: { slug: string; startedAt: number } | null
  startTimer: (slug: string) => void
  cancelTimer: () => void
  // A finished timed brew waiting to be diagnosed; Diagnose takes its time and clears it
  timed: { slug: string; time: number } | null
  finishTimer: (time: number) => void
  takeTimed: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Persisted>(load)
  const [timer, setTimer] = useState<Store['timer']>(null)
  const [timed, setTimed] = useState<Store['timed']>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
    document.documentElement.lang = s.lang
  }, [s])

  const t = useCallback((key: Key, vars?: Record<string, string | number>) => translate(s.lang, key, vars), [s.lang])

  const value = useMemo<Store>(() => {
    return {
      ...s,
      t,
      brew: brewOf(s.method, s.roast, s.brewer),
      slug: slugOf(brewOf(s.method, s.roast, s.brewer)),
      setLang: (lang) => setS((p) => ({ ...p, lang })),
      setMethod: (method) => setS((p) => ({ ...p, method })),
      setRoast: (roast) => setS((p) => ({ ...p, roast })),
      setBrewer: (brewer) => setS((p) => ({ ...p, brewer })),
      setLot: (lot) => setS((p) => ({ ...p, lot })),
      addReport: (report) => setS((p) => ({ ...p, reports: [report, ...p.reports] })),
      markWorking: (key, reportId) => setS((p) => ({ ...p, working: { ...p.working, [key]: reportId } })),
      reset: () => setS((p) => ({ ...p, reports: [], working: {} })),
      timer,
      startTimer: (slug) => setTimer({ slug, startedAt: Date.now() }),
      cancelTimer: () => setTimer(null),
      timed,
      finishTimer: (time) => {
        if (timer) setTimed({ slug: timer.slug, time })
        setTimer(null)
      },
      takeTimed: () => setTimed(null),
    }
  }, [s, t, timer, timed])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('StoreProvider missing')
  return v
}
