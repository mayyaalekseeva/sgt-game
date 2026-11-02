import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isMyRef, mergeCoffees, parseCoffees, type MyCoffee } from './coffees'
import { BREWERS, type Brewer, type Lang, type Method, type Report, type Roast } from './data'
import { parsePassed, type DrillId, type Passed } from './drills'
import { translate, type Key } from './i18n'
import { lotBySlug } from './lots'
import { withEdit, type EditFields } from './sync'

const STORAGE_KEY = 'barista-game:v1'

interface Persisted {
  lang: Lang
  method: Method
  roast: Roast // espresso
  brewer: Brewer // filter
  lot: string | null // a lot slug or a my: coffee ref; null until one is picked (the first lot is shown)
  reports: Report[]
  working: Record<string, string> // working key (src/coffees.ts workingKey) -> report id
  coffees: MyCoffee[] // the guest's own coffees
  drills: Passed // the guest's passed drill field tests
  sound: boolean // brew timer tones
}

const initial = (): Persisted => ({
  lang: navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en',
  method: 'espresso',
  roast: 'medium',
  brewer: 'v60',
  lot: null,
  reports: [],
  working: {},
  coffees: [],
  drills: {},
  sound: true,
})

function load(): Persisted {
  const base = initial()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = { ...base, ...JSON.parse(raw) } as Persisted
      // saved before brewers, lots or coffees existed, or the lot left the content file
      return {
        ...saved,
        brewer: BREWERS.includes(saved.brewer) ? saved.brewer : base.brewer,
        lot: isMyRef(saved.lot) || lotBySlug(saved.lot) ? saved.lot : null,
        coffees: parseCoffees(saved.coffees),
        drills: parsePassed(saved.drills),
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
  setSound: (on: boolean) => void
  addReport: (r: Report) => void
  markWorking: (key: string, reportId: string) => void
  editReport: (id: string, fields: EditFields) => void
  deleteReport: (id: string) => void
  reset: () => void
  saveCoffee: (c: MyCoffee) => void
  passDrill: (id: DrillId, at: number) => void
  // after the guest data went to an account at first sign-in
  clearGuest: () => void
  // Brew timer, kept in memory only: it survives switching tabs, not a reload
  timer: { slug: string; roast?: Roast; startedAt: number } | null // roast: of your own coffee, which shifts the recipe
  startTimer: (slug: string, roast?: Roast) => void
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
      setLang: (lang) => setS((p) => ({ ...p, lang })),
      setMethod: (method) => setS((p) => ({ ...p, method })),
      setRoast: (roast) => setS((p) => ({ ...p, roast })),
      setBrewer: (brewer) => setS((p) => ({ ...p, brewer })),
      setLot: (lot) => setS((p) => ({ ...p, lot })),
      setSound: (sound) => setS((p) => ({ ...p, sound })),
      addReport: (report) => setS((p) => ({ ...p, reports: [report, ...p.reports] })),
      markWorking: (key, reportId) => setS((p) => ({ ...p, working: { ...p.working, [key]: reportId } })),
      editReport: (id, fields) =>
        setS((p) => {
          const edit = { grinder: fields.grinder?.trim(), grinderModel: fields.grinderModel || undefined, notes: fields.notes?.trim(), editedAt: Date.now() }
          return { ...p, reports: p.reports.map((r) => (r.id === id ? withEdit(r, edit) : r)) }
        }),
      deleteReport: (id) =>
        setS((p) => ({
          ...p,
          reports: p.reports.filter((r) => r.id !== id),
          working: Object.fromEntries(Object.entries(p.working).filter(([, r]) => r !== id)),
        })),
      reset: () => setS((p) => ({ ...p, reports: [], working: {}, drills: {} })),
      saveCoffee: (c) => setS((p) => ({ ...p, coffees: mergeCoffees(p.coffees, [c]) })),
      passDrill: (id, at) => setS((p) => (p.drills[id] !== undefined ? p : { ...p, drills: { ...p.drills, [id]: at } })),
      clearGuest: () => setS((p) => ({ ...p, reports: [], working: {}, coffees: [], drills: {} })),
      timer,
      startTimer: (slug, roast) => setTimer({ slug, ...(roast ? { roast } : {}), startedAt: Date.now() }),
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
