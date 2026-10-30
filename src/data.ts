import recipeContent from '../content/recipes.json' with { type: 'json' }

export type Lang = 'en' | 'pt'
export type Method = 'espresso' | 'filter'
export type Roast = 'light' | 'medium' | 'dark'
export type Taste = 'sour' | 'bitter' | 'thin' | 'balanced'
// Filter brewers. Pour-over drains through the bed; immersion steeps, then separates (press or drawdown).
export type Brewer = 'v60' | 'aeropress' | 'frenchpress'
export type BrewStyle = 'pour' | 'steep'
export type Grind = 'fine' | 'medium_fine' | 'medium' | 'medium_coarse' | 'coarse'
export type StepKind = 'bloom' | 'pour' | 'stir' | 'swirl' | 'cap' | 'break' | 'skim' | 'press'

// One action at `at` seconds from the first water. bloom and pour fill the brewer up to `to` grams of water.
export interface Step {
  at: number
  kind: StepKind
  to?: number
}

/**
 * What a brew is made with. Espresso picks a roast level; filter picks a brewer, and its roast comes from
 * the coffee lot (not modelled yet). Older filter reports and archived recipes still carry a roast.
 */
export interface Brew {
  method: Method
  roast?: Roast
  brewer?: Brewer
}

export interface Recipe {
  dose: number // g
  yield: number // g: espresso in the cup, filter water poured
  time: [number, number] // s: espresso shot; filter from first water to the end of drawdown or press
  temp: [number, number] // °C
  grind?: Grind // brewer recipes only
  steps?: Step[] // brewer recipes only
}

export interface RecipeVersion extends Recipe {
  id: string // `${slug}@${version}`, referenced by reports
  version: number
  publishedAt: string // YYYY-MM-DD
}

export interface RecipeEntry extends Brew {
  slug: string
  status: 'published' | 'archived'
  versions: RecipeVersion[] // ascending, append-only
}

export const METHODS: Method[] = ['espresso', 'filter']
export const ROASTS: Roast[] = ['light', 'medium', 'dark']
export const BREWERS: Brewer[] = ['v60', 'aeropress', 'frenchpress']
export const GRINDS: Grind[] = ['fine', 'medium_fine', 'medium', 'medium_coarse', 'coarse']
export const STEP_KINDS: StepKind[] = ['bloom', 'pour', 'stir', 'swirl', 'cap', 'break', 'skim', 'press']
export const STYLE_OF: Record<Brewer, BrewStyle> = { v60: 'pour', aeropress: 'steep', frenchpress: 'steep' }

/** Recipe slug, also the working-recipe key: "espresso-medium", "filter-v60"; old filter brews "filter-light". */
export const slugOf = (b: Brew) => (b.method === 'filter' && b.brewer ? `filter-${b.brewer}` : `${b.method}-${b.roast}`)

/** The picker's choice: espresso uses the roast, filter the brewer. */
export const brewOf = (method: Method, roast: Roast, brewer: Brewer): Brew =>
  method === 'espresso' ? { method, roast } : { method, brewer }

// The recipes the picker offers
export const ACTIVE_SLUGS = [
  ...ROASTS.map((roast) => slugOf({ method: 'espresso', roast })),
  ...BREWERS.map((brewer) => slugOf({ method: 'filter', brewer })),
]

const isRange = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && n > 0) && v[0] <= v[1]

const isStep = (v: unknown): v is Step => {
  const st = v as Step
  if (typeof st !== 'object' || st === null || !Number.isInteger(st.at) || st.at < 0) return false
  if (!STEP_KINDS.includes(st.kind)) return false
  const fills = st.kind === 'bloom' || st.kind === 'pour'
  return fills ? typeof st.to === 'number' && st.to > 0 : st.to === undefined
}

/**
 * Validates content/recipes.json, or the same shape from GET /api/recipes. Published versions are
 * immutable: a change is a new version. Every recipe the picker offers (ACTIVE_SLUGS) must be present.
 * Filter recipes are per brewer, with a grind and steps; per-roast filter recipes are kept archived only.
 */
export function parseRecipeContent(raw: unknown, source = 'content/recipes.json'): RecipeEntry[] {
  const fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`)
  }
  const list = (raw as { recipes?: unknown })?.recipes
  if (!Array.isArray(list)) fail('expected { recipes: [...] }')
  const entries = (list as Record<string, unknown>[]).map((e): RecipeEntry => {
    const { slug, method, status, versions } = e
    // the API sends null for a missing roast or brewer
    const roast = e.roast ?? undefined
    const brewer = e.brewer ?? undefined
    if (!METHODS.includes(method as Method)) fail(`unknown method ${String(method)}`)
    if (roast !== undefined && !ROASTS.includes(roast as Roast)) fail(`${String(slug)}: unknown roast ${String(roast)}`)
    if (brewer !== undefined && !BREWERS.includes(brewer as Brewer)) fail(`${String(slug)}: unknown brewer ${String(brewer)}`)
    if (method === 'espresso' && (roast === undefined || brewer !== undefined)) fail(`${String(slug)}: espresso needs a roast and no brewer`)
    if (method === 'filter' && (roast === undefined) === (brewer === undefined)) fail(`${String(slug)}: filter needs a brewer, or a roast if archived`)
    if (method === 'filter' && roast !== undefined && status !== 'archived') fail(`${String(slug)}: per-roast filter recipes must be archived`)
    const brew: Brew = { method: method as Method, roast: roast as Roast | undefined, brewer: brewer as Brewer | undefined }
    if (slug !== slugOf(brew)) fail(`slug ${String(slug)} must be "${slugOf(brew)}"`)
    if (status !== 'published' && status !== 'archived') fail(`${slug}: unknown status ${String(status)}`)
    if (!Array.isArray(versions) || versions.length === 0) fail(`${slug}: needs at least one version`)
    return {
      slug: slug as string,
      method: brew.method,
      ...(brew.roast ? { roast: brew.roast } : {}),
      ...(brew.brewer ? { brewer: brew.brewer } : {}),
      status: status as RecipeEntry['status'],
      versions: (versions as Record<string, unknown>[]).map((v, i): RecipeVersion => {
        const at = `${slug} v${String(v.version)}`
        if (v.version !== i + 1) fail(`${slug}: versions must be 1, 2, 3... in order`)
        if (typeof v.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.publishedAt)) fail(`${at}: publishedAt must be YYYY-MM-DD`)
        if (typeof v.dose !== 'number' || v.dose <= 0) fail(`${at}: dose must be a positive number`)
        if (typeof v.yield !== 'number' || v.yield <= 0) fail(`${at}: yield must be a positive number`)
        if (!isRange(v.time)) fail(`${at}: time must be [min, max] seconds`)
        if (!isRange(v.temp)) fail(`${at}: temp must be [min, max] °C`)
        const out: RecipeVersion = {
          id: `${slug}@${i + 1}`,
          version: i + 1,
          publishedAt: v.publishedAt as string,
          dose: v.dose as number,
          yield: v.yield as number,
          time: v.time as [number, number],
          temp: v.temp as [number, number],
        }
        const grind = v.grind ?? undefined
        const steps = v.steps ?? undefined
        if (!brew.brewer) {
          if (grind !== undefined || steps !== undefined) fail(`${at}: grind and steps are for brewer recipes`)
          return out
        }
        if (!GRINDS.includes(grind as Grind)) fail(`${at}: grind must be one of ${GRINDS.join(', ')}`)
        if (!Array.isArray(steps) || steps.length === 0 || !steps.every(isStep)) {
          fail(`${at}: steps must be [{ at, kind, to? }] with to on bloom and pour only`)
        }
        const ss = steps as Step[]
        if (ss[0].at !== 0) fail(`${at}: the first step starts at 0`)
        if (ss.some((st, j) => j > 0 && st.at < ss[j - 1].at)) fail(`${at}: steps must be in time order`)
        if (ss[ss.length - 1].at >= out.time[1]) fail(`${at}: the last step must start before the end of the time range`)
        const fills = ss.flatMap((st) => (st.to !== undefined ? [st.to] : []))
        if (fills.length === 0 || fills.some((w, j) => j > 0 && w <= fills[j - 1])) fail(`${at}: bloom and pour targets must rise`)
        if (fills[fills.length - 1] !== out.yield) fail(`${at}: the last pour must reach the yield (${out.yield} g)`)
        return { ...out, grind: grind as Grind, steps: ss.map(({ at: s, kind, to }) => (to === undefined ? { at: s, kind } : { at: s, kind, to })) }
      }),
    }
  })
  const slugs = entries.map((e) => e.slug)
  const dup = slugs.find((x, i) => slugs.indexOf(x) !== i)
  if (dup) fail(`${dup} appears more than once`)
  for (const k of ACTIVE_SLUGS) if (!slugs.includes(k)) fail(`${k} is missing`)
  return entries
}

export const latestVersion = (e: RecipeEntry) => e.versions[e.versions.length - 1]

// STARTING POINTS ONLY. To be verified with the roaster before any real use.
export const RECIPE_CONTENT = parseRecipeContent(recipeContent)

// Latest version per slug, archived recipes included: older reports still point at them
export const RECIPES: Record<string, RecipeVersion> = Object.fromEntries(RECIPE_CONTENT.map((e) => [e.slug, latestVersion(e)]))

export const RANKS = [
  { id: 'recruta', xp: 0 },
  { id: 'cabo', xp: 200 },
  { id: 'furriel', xp: 500 },
  { id: 'sargento', xp: 900 },
] as const
export type RankId = (typeof RANKS)[number]['id']

export const REPORT_XP = 25

export function rankFor(xp: number) {
  let idx = 0
  RANKS.forEach((r, i) => {
    if (xp >= r.xp) idx = i
  })
  const cur = RANKS[idx]
  const next = RANKS[idx + 1] ?? null
  const pct = next ? Math.min(100, ((xp - cur.xp) / (next.xp - cur.xp)) * 100) : 100
  return { idx, cur, next, pct }
}

export interface Report extends Brew {
  id: string
  ts: number
  dose: number
  yield: number
  time: number
  taste: Taste
  diag: string
  recipeVersionId?: string // `${slug}@${version}` the brew was diagnosed against; missing on older reports
  lot?: string // a lot slug (src/lots.ts) or a my: coffee ref (src/coffees.ts); missing on older reports
  grinder?: string // the grinder setting as the player writes it ("18 clicks"); with notes, what a saved recipe keeps
  notes?: string
  timed?: true // brewed with the brew timer
  photo?: string // the current photo's nonce (worker/photos.ts); signed-in reports only
  editedAt?: number // grinder or notes changed after filing; the numbers never change
}

export const MAX_GRINDER = 30
export const MAX_NOTES = 280

export const TASTES: Taste[] = ['sour', 'bitter', 'thin', 'balanced']

/** Espresso has a roast; filter a brewer, or a roast on reports from before brewers. null counts as absent. */
export function isBrew(r: { method?: unknown; roast?: unknown; brewer?: unknown }) {
  const roast = r.roast ?? undefined
  const brewer = r.brewer ?? undefined
  if (roast !== undefined && !ROASTS.includes(roast as Roast)) return false
  if (brewer !== undefined && !BREWERS.includes(brewer as Brewer)) return false
  if (r.method === 'espresso') return roast !== undefined && brewer === undefined
  if (r.method === 'filter') return roast !== undefined || brewer !== undefined
  return false
}

// Same as the server's nonce (worker/photos.ts): it goes into the photo URL
export const isPhotoNonce = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{16}$/.test(v)

/** Validates a GET /api/reports body: { reports, working }. */
export function parseReportsResponse(raw: unknown): { reports: Report[]; working: Record<string, string> } {
  const fail = (msg: string): never => {
    throw new Error(`GET /api/reports: ${msg}`)
  }
  const { reports, working } = (raw ?? {}) as { reports?: unknown; working?: unknown }
  if (!Array.isArray(reports)) fail('expected { reports: [...] }')
  if (typeof working !== 'object' || working === null || Array.isArray(working)) fail('expected { working: {...} }')
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  return {
    reports: (reports as Record<string, unknown>[]).map((r, i): Report => {
      const ok =
        typeof r === 'object' &&
        r !== null &&
        typeof r.id === 'string' &&
        num(r.ts) &&
        isBrew(r) &&
        num(r.dose) &&
        num(r.yield) &&
        num(r.time) &&
        TASTES.includes(r.taste as Taste) &&
        typeof r.diag === 'string' &&
        (r.recipeVersionId == null || typeof r.recipeVersionId === 'string') &&
        (r.lot == null || typeof r.lot === 'string') &&
        (r.grinder == null || typeof r.grinder === 'string') &&
        (r.notes == null || typeof r.notes === 'string') &&
        (r.timed == null || typeof r.timed === 'boolean') &&
        (r.photo == null || isPhotoNonce(r.photo)) &&
        (r.editedAt == null || num(r.editedAt))
      if (!ok) fail(`reports[${i}] is invalid`)
      return {
        id: r.id as string,
        ts: r.ts as number,
        method: r.method as Method,
        ...(r.roast != null ? { roast: r.roast as Roast } : {}),
        ...(r.brewer != null ? { brewer: r.brewer as Brewer } : {}),
        dose: r.dose as number,
        yield: r.yield as number,
        time: r.time as number,
        taste: r.taste as Taste,
        diag: r.diag as string,
        ...(typeof r.recipeVersionId === 'string' ? { recipeVersionId: r.recipeVersionId } : {}),
        ...(typeof r.lot === 'string' ? { lot: r.lot } : {}),
        ...(typeof r.grinder === 'string' && r.grinder !== '' ? { grinder: r.grinder } : {}),
        ...(typeof r.notes === 'string' && r.notes !== '' ? { notes: r.notes } : {}),
        ...(r.timed === true ? { timed: true as const } : {}),
        ...(isPhotoNonce(r.photo) ? { photo: r.photo } : {}),
        ...(num(r.editedAt) ? { editedAt: r.editedAt as number } : {}),
      }
    }),
    working: Object.fromEntries(
      Object.entries(working as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'),
    ),
  }
}

// Calendar day in the viewer's time zone, YYYY-MM-DD
export const localDay = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Diary: reports grouped by day, newest day first and newest report first within a day. */
/** Feed: the reports with a photo, newest first. */
export const feedReports = (reports: Report[]) =>
  reports.filter((r): r is Report & { photo: string } => !!r.photo).sort((a, b) => b.ts - a.ts)

export function diaryDays(reports: Report[], dayOf: (ts: number) => string = localDay) {
  const days = new Map<string, Report[]>()
  for (const r of [...reports].sort((a, b) => b.ts - a.ts)) {
    const k = dayOf(r.ts)
    days.set(k, [...(days.get(k) ?? []), r])
  }
  return [...days].map(([day, rs]) => ({ day, reports: rs }))
}

/** The version a report was diagnosed against; undefined for older reports and unknown ids. */
export function versionOf(entries: RecipeEntry[], id: string | undefined) {
  if (!id) return undefined
  for (const e of entries) for (const v of e.versions) if (v.id === id) return v
  return undefined
}

export interface MissionDef {
  id: string
  xp: number
  goal: number
  progress: (reports: Report[], working: Record<string, string>) => number
}

const distinct = <T,>(a: T[]) => new Set(a).size

// The coffees with a working recipe; keys are "slug|lot" (src/coffees.ts workingKey), older ones just "slug"
const workingLots = (w: Record<string, string>) => [...new Set(Object.keys(w).flatMap((k) => (k.includes('|') ? [k.split('|')[1]] : [])))]

export const MISSIONS: MissionDef[] = [
  { id: 'm1', xp: 50, goal: 1, progress: (r) => r.length },
  { id: 'm2', xp: 75, goal: 1, progress: (r) => r.filter((x) => x.taste === 'balanced').length },
  { id: 'm3', xp: 75, goal: 2, progress: (r) => distinct(r.map((x) => x.method)) },
  { id: 'm4', xp: 100, goal: 3, progress: (r) => distinct(r.flatMap((x) => (x.roast ? [x.roast] : []))) },
  { id: 'm5', xp: 100, goal: 1, progress: (_r, w) => Object.keys(w).length },
  { id: 'm6', xp: 100, goal: 5, progress: (r) => r.length },
  { id: 'm7', xp: 100, goal: 3, progress: (r) => distinct(r.flatMap((x) => (x.brewer ? [x.brewer] : []))) },
  { id: 'm8', xp: 75, goal: 1, progress: (r) => r.filter((x) => x.timed).length },
  { id: 'm9', xp: 75, goal: 1, progress: (r) => r.filter((x) => x.lot?.startsWith('my:')).length },
  { id: 'm10', xp: 100, goal: 1, progress: (_r, w) => workingLots(w).filter((l) => !l.startsWith('my:')).length },
  { id: 'm11', xp: 150, goal: 2, progress: (_r, w) => workingLots(w).length },
]

// XP, rank and mission progress are always derived from reports, never stored
export function progressFor(reports: Report[], working: Record<string, string>) {
  const missions = MISSIONS.map((m) => {
    const cur = Math.min(m.goal, m.progress(reports, working))
    return { id: m.id, xp: m.xp, goal: m.goal, cur, done: cur >= m.goal }
  })
  const xp = reports.length * REPORT_XP + missions.filter((m) => m.done).reduce((a, m) => a + m.xp, 0)
  return { xp, rank: rankFor(xp), missions }
}

export const CHAPTERS:{ id: string; rank: number }[] = [
  { id: 'c1', rank: 0 },
  { id: 'c2', rank: 1 },
  { id: 'c3', rank: 2 },
  { id: 'c4', rank: 3 },
]
