import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BREWERS, brewOf, slugOf, type Brew, type Brewer, type Lang, type Method, type Report, type Roast } from './data'
import { translate, type Key } from './i18n'

const STORAGE_KEY = 'barista-game:v1'

interface Persisted {
  lang: Lang
  method: Method
  roast: Roast // espresso
  brewer: Brewer // filter
  reports: Report[]
  working: Record<string, string> // recipe slug -> report id
}

const initial = (): Persisted => ({
  lang: navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en',
  method: 'espresso',
  roast: 'medium',
  brewer: 'v60',
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
      return BREWERS.includes(saved.brewer) ? saved : { ...saved, brewer: base.brewer }
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
  brew: Brew // the picked recipe: espresso + roast or filter + brewer
  slug: string
  addReport: (r: Report) => void
  markWorking: (key: string, reportId: string) => void
  reset: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Persisted>(load)

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
      addReport: (report) => setS((p) => ({ ...p, reports: [report, ...p.reports] })),
      markWorking: (key, reportId) => setS((p) => ({ ...p, working: { ...p.working, [key]: reportId } })),
      reset: () => setS((p) => ({ ...p, reports: [], working: {} })),
    }
  }, [s, t])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('StoreProvider missing')
  return v
}
