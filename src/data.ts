import recipeContent from '../content/recipes.json' with { type: 'json' }

export type Lang = 'en' | 'pt'
export type Method = 'espresso' | 'filter'
export type Roast = 'light' | 'medium' | 'dark'
export type Taste = 'sour' | 'bitter' | 'thin' | 'balanced'
export type RecipeKey = `${Method}-${Roast}`

export interface Recipe {
  dose: number // g
  yield: number // g
  time: [number, number] // s
  temp: [number, number] // °C
}

export interface RecipeVersion extends Recipe {
  id: string // `${slug}@${version}`, referenced by reports
  version: number
  publishedAt: string // YYYY-MM-DD
}

export interface RecipeEntry {
  slug: RecipeKey
  method: Method
  roast: Roast
  status: 'published' | 'archived'
  versions: RecipeVersion[] // ascending, append-only
}

export const METHODS: Method[] = ['espresso', 'filter']
export const ROASTS: Roast[] = ['light', 'medium', 'dark']

export const recipeKey = (m: Method, r: Roast) => `${m}-${r}` as const

const isRange = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && n > 0) && v[0] <= v[1]

/**
 * Validates content/recipes.json, or the same shape from GET /api/recipes. Published versions are
 * immutable: a change is a new version. Every method x roast must be present, because the picker
 * offers all of them.
 */
export function parseRecipeContent(raw: unknown, source = 'content/recipes.json'): RecipeEntry[] {
  const fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`)
  }
  const list = (raw as { recipes?: unknown })?.recipes
  if (!Array.isArray(list)) fail('expected { recipes: [...] }')
  const entries = (list as Record<string, unknown>[]).map((e): RecipeEntry => {
    const { slug, method, roast, status, versions } = e
    if (!METHODS.includes(method as Method)) fail(`unknown method ${String(method)}`)
    if (!ROASTS.includes(roast as Roast)) fail(`unknown roast ${String(roast)}`)
    if (slug !== recipeKey(method as Method, roast as Roast)) fail(`slug ${String(slug)} must be "${String(method)}-${String(roast)}"`)
    if (status !== 'published' && status !== 'archived') fail(`${slug}: unknown status ${String(status)}`)
    if (!Array.isArray(versions) || versions.length === 0) fail(`${slug}: needs at least one version`)
    return {
      slug: slug as RecipeKey,
      method: method as Method,
      roast: roast as Roast,
      status: status as RecipeEntry['status'],
      versions: (versions as Record<string, unknown>[]).map((v, i) => {
        const at = `${slug} v${String(v.version)}`
        if (v.version !== i + 1) fail(`${slug}: versions must be 1, 2, 3... in order`)
        if (typeof v.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.publishedAt)) fail(`${at}: publishedAt must be YYYY-MM-DD`)
        if (typeof v.dose !== 'number' || v.dose <= 0) fail(`${at}: dose must be a positive number`)
        if (typeof v.yield !== 'number' || v.yield <= 0) fail(`${at}: yield must be a positive number`)
        if (!isRange(v.time)) fail(`${at}: time must be [min, max] seconds`)
        if (!isRange(v.temp)) fail(`${at}: temp must be [min, max] °C`)
        return {
          id: `${slug}@${i + 1}`,
          version: i + 1,
          publishedAt: v.publishedAt as string,
          dose: v.dose as number,
          yield: v.yield as number,
          time: v.time as [number, number],
          temp: v.temp as [number, number],
        }
      }),
    }
  })
  for (const m of METHODS) {
    for (const r of ROASTS) {
      const n = entries.filter((e) => e.slug === recipeKey(m, r)).length
      if (n !== 1) fail(`${recipeKey(m, r)} must appear exactly once (found ${n})`)
    }
  }
  return entries
}

export const latestVersion = (e: RecipeEntry) => e.versions[e.versions.length - 1]

// STARTING POINTS ONLY. To be verified with the roaster before any real use.
export const RECIPE_CONTENT = parseRecipeContent(recipeContent)

export const RECIPES = Object.fromEntries(RECIPE_CONTENT.map((e) => [e.slug, latestVersion(e)])) as Record<RecipeKey, RecipeVersion>

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

export interface Report {
  id: string
  ts: number
  method: Method
  roast: Roast
  dose: number
  yield: number
  time: number
  taste: Taste
  diag: string
  recipeVersionId?: string // `${slug}@${version}` the brew was diagnosed against; missing on older reports
}

export const TASTES: Taste[] = ['sour', 'bitter', 'thin', 'balanced']

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
        METHODS.includes(r.method as Method) &&
        ROASTS.includes(r.roast as Roast) &&
        num(r.dose) &&
        num(r.yield) &&
        num(r.time) &&
        TASTES.includes(r.taste as Taste) &&
        typeof r.diag === 'string' &&
        (r.recipeVersionId == null || typeof r.recipeVersionId === 'string')
      if (!ok) fail(`reports[${i}] is invalid`)
      return {
        id: r.id as string,
        ts: r.ts as number,
        method: r.method as Method,
        roast: r.roast as Roast,
        dose: r.dose as number,
        yield: r.yield as number,
        time: r.time as number,
        taste: r.taste as Taste,
        diag: r.diag as string,
        ...(typeof r.recipeVersionId === 'string' ? { recipeVersionId: r.recipeVersionId } : {}),
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

export const MISSIONS: MissionDef[] = [
  { id: 'm1', xp: 50, goal: 1, progress: (r) => r.length },
  { id: 'm2', xp: 75, goal: 1, progress: (r) => r.filter((x) => x.taste === 'balanced').length },
  { id: 'm3', xp: 75, goal: 2, progress: (r) => distinct(r.map((x) => x.method)) },
  { id: 'm4', xp: 100, goal: 3, progress: (r) => distinct(r.map((x) => x.roast)) },
  { id: 'm5', xp: 100, goal: 1, progress: (_r, w) => Object.keys(w).length },
  { id: 'm6', xp: 100, goal: 5, progress: (r) => r.length },
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
