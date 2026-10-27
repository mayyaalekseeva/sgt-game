import { GRINDS, ROASTS, brewOf, slugOf, type Brew, type Brewer, type Lang, type Method, type Recipe, type Roast } from './data'
import { currentLots, lotBySlug } from './lots'

// How the cherry was processed, as roasters label their bags
export type Process = 'washed' | 'natural' | 'honey' | 'anaerobic' | 'decaf' | 'other'
export const PROCESSES: Process[] = ['washed', 'natural', 'honey', 'anaerobic', 'decaf', 'other']

/** A coffee the player added: any roaster's bag. Referenced as `my:<id>` wherever a lot slug goes. */
export interface MyCoffee {
  id: string // 32 hex characters, made on the client like report ids
  roaster: string
  origin: string
  process: Process
  roast: Roast
  name?: string
  archived?: boolean // the bag is finished: out of the picker, still named in older reports
  roastedOn?: string // YYYY-MM-DD from the bag, for freshness
  updatedAt: number // epoch ms; the newer copy wins when syncing
}

const ID = /^[0-9a-f]{32}$/
export const MY_PREFIX = 'my:'
export const myRef = (id: string) => `${MY_PREFIX}${id}`
export const isMyRef = (ref: string | null | undefined): ref is string => !!ref && ref.startsWith(MY_PREFIX)
export const MAX_TEXT = 60

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))

const text = (v: unknown) => typeof v === 'string' && v.trim() !== '' && v.length <= MAX_TEXT

/** One coffee from storage or the API; null if it does not hold up. Unknown fields are dropped. */
export function parseCoffee(raw: unknown): MyCoffee | null {
  const c = raw as Record<string, unknown>
  if (typeof c !== 'object' || c === null) return null
  if (typeof c.id !== 'string' || !ID.test(c.id)) return null
  if (!text(c.roaster) || !text(c.origin)) return null
  if (!PROCESSES.includes(c.process as Process) || !ROASTS.includes(c.roast as Roast)) return null
  if (c.name != null && c.name !== '' && !text(c.name)) return null
  if (typeof c.updatedAt !== 'number' || !Number.isFinite(c.updatedAt)) return null
  if (c.roastedOn != null && !isDay(c.roastedOn)) return null
  return {
    id: c.id,
    roaster: (c.roaster as string).trim(),
    origin: (c.origin as string).trim(),
    process: c.process as Process,
    roast: c.roast as Roast,
    ...(typeof c.name === 'string' && c.name.trim() !== '' ? { name: c.name.trim() } : {}),
    ...(c.archived === true ? { archived: true } : {}),
    ...(typeof c.roastedOn === 'string' ? { roastedOn: c.roastedOn } : {}),
    updatedAt: c.updatedAt,
  }
}

/** A list from storage or the API: bad entries are skipped, not fatal. */
export const parseCoffees = (raw: unknown): MyCoffee[] =>
  Array.isArray(raw) ? raw.map(parseCoffee).filter((c): c is MyCoffee => c !== null) : []

/** Merges two copies by id; the later edit wins. */
export function mergeCoffees(a: MyCoffee[], b: MyCoffee[]): MyCoffee[] {
  const byId = new Map(a.map((c) => [c.id, c]))
  for (const c of b) {
    const have = byId.get(c.id)
    if (!have || c.updatedAt >= have.updatedAt) byId.set(c.id, c)
  }
  return [...byId.values()].sort((x, y) => x.updatedAt - y.updatedAt)
}

export const findMine = (coffees: MyCoffee[], ref: string | null | undefined) =>
  isMyRef(ref) ? coffees.find((c) => myRef(c.id) === ref) : undefined

/** The name to show for a lot slug or `my:` ref; undefined when it is not known here. */
export function coffeeName(ref: string | null | undefined, coffees: MyCoffee[]) {
  const mine = findMine(coffees, ref)
  if (mine) return mine.name ?? `${mine.roaster} · ${mine.origin}`
  return lotBySlug(ref)?.name
}

/** Working recipes are kept per coffee and recipe: "filter-v60|peru-naranjo-yacu"; no coffee keeps the bare slug. */
export const workingKey = (b: Brew & { lot?: string | null }) => (b.lot ? `${slugOf(b)}|${b.lot}` : slugOf(b))

export interface Pick {
  lot: string // a lot slug or a my: ref; always set, every brew is of some coffee
  mine?: MyCoffee
  brew: Brew
  slug: string
  key: string // working-recipe key
}

/**
 * What the picker's choices add up to. A stored lot that is gone (retired, or another account's coffee)
 * falls back to the first current lot. Your own coffee knows its roast, so for espresso it sets the
 * roast; the roaster's lots leave the roast to the picker.
 */
export function resolvePick(
  s: { method: Method; roast: Roast; brewer: Brewer; lot: string | null },
  coffees: MyCoffee[],
): Pick {
  const mine = findMine(coffees, s.lot)
  const lot = mine || (s.lot && lotBySlug(s.lot)?.status === 'current') ? (s.lot as string) : currentLots()[0].slug
  const roast = mine ? mine.roast : s.roast
  const brew = brewOf(s.method, roast, s.brewer)
  return { lot, ...(mine ? { mine } : {}), brew, slug: slugOf(brew), key: workingKey({ ...brew, lot }) }
}

const shiftGrind = (g: Recipe['grind'], by: number) => (g ? GRINDS[Math.min(GRINDS.length - 1, Math.max(0, GRINDS.indexOf(g) + by))] : g)

/**
 * A brewer recipe is written for a light-to-medium filter roast. For your own coffee of a known roast it
 * shifts the usual way: light hotter and a step finer, dark cooler and a step coarser. Espresso recipes
 * are already per roast, and the roaster's lots will get their own recipes.
 */
export function forRoast<R extends Recipe>(r: R, roast: Roast | undefined): R {
  if (!r.steps || !roast || roast === 'medium') return r
  if (roast === 'light') return { ...r, temp: [Math.min(r.temp[0] + 2, r.temp[1]), r.temp[1]], grind: shiftGrind(r.grind, -1) }
  return { ...r, temp: [r.temp[0] - 4, r.temp[1] - 4], grind: shiftGrind(r.grind, 1) }
}

/** The lot labels for the picker, by language */
export const lotOptionLabel = (slug: string, lang: Lang) => {
  const l = lotBySlug(slug)
  return l ? `${l.name} · ${l.country[lang]}` : slug
}

export type Freshness = 'resting' | 'peak' | 'fading' | 'stale'

const dayNumber = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`) / 86_400_000

/**
 * How a bag is doing, from its roast date to today (both YYYY-MM-DD). Fresh coffee is still giving off
 * CO2: filter wants about 3 days of rest, espresso about a week. A month is the usual peak; after two it
 * tastes flat. Null without a date, or for a date in the future.
 */
export function freshness(roastedOn: string | undefined, today: string, method: Method): { days: number; stage: Freshness } | null {
  if (!roastedOn) return null
  const days = Math.round(dayNumber(today) - dayNumber(roastedOn))
  if (!Number.isFinite(days) || days < 0) return null
  const rest = method === 'espresso' ? 7 : 3
  const stage: Freshness = days < rest ? 'resting' : days <= 30 ? 'peak' : days <= 60 ? 'fading' : 'stale'
  return { days, stage }
}
