import { describe, expect, it } from 'vitest'
import content from '../content/recipes.json' with { type: 'json' }
import {
  MISSIONS,
  RANKS,
  RECIPES,
  RECIPE_CONTENT,
  REPORT_XP,
  diaryDays,
  feedReports,
  parseRecipeContent,
  parseReportsResponse,
  progressFor,
  rankFor,
  versionOf,
  type Report,
} from './data'

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 9, 26, 9, 0)

let n = 0
const report = (over: Partial<Report> = {}): Report => ({
  id: `r${++n}`,
  ts: T0,
  method: 'espresso',
  roast: 'medium',
  dose: 18,
  yield: 36,
  time: 27,
  taste: 'balanced',
  diag: 'balanced',
  ...over,
})

const progress = (id: string, reports: Report[], working: Record<string, string> = {}) => {
  const m = MISSIONS.find((x) => x.id === id)
  if (!m) throw new Error(`no mission ${id}`)
  return m.progress(reports, working)
}

describe('new missions', () => {
  const MY = 'my:' + 'a'.repeat(32)

  it('m7 counts distinct brewers', () => {
    const rs = [report({ method: 'filter', roast: undefined, brewer: 'v60' }), report({ method: 'filter', roast: undefined, brewer: 'v60' }), report()]
    expect(progress('m7', rs)).toBe(1)
    expect(progress('m7', [...rs, report({ method: 'filter', roast: undefined, brewer: 'aeropress' })])).toBe(2)
  })

  it('m8 counts timed brews', () => {
    expect(progress('m8', [report(), report({ timed: true })])).toBe(1)
  })

  it('m9 counts brews of your own coffees', () => {
    expect(progress('m9', [report({ lot: 'peru-naranjo-yacu' }), report({ lot: MY })])).toBe(1)
  })

  it('m10 counts roaster lots with a working recipe; m11 any coffee', () => {
    const w = { 'espresso-medium': 'a', 'filter-v60|peru-naranjo-yacu': 'b', 'espresso-light|peru-naranjo-yacu': 'c', [`filter-v60|${MY}`]: 'd' }
    expect(progress('m10', [], w)).toBe(1)
    expect(progress('m11', [], w)).toBe(2)
  })
})

describe('missions', () => {
  it('have unique ids and positive goals', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length)
    for (const m of MISSIONS) expect(m.goal).toBeGreaterThan(0)
  })

  it.each(MISSIONS.map((m) => m.id))('%s: no progress on empty input', (id) => {
    expect(progress(id, [], {})).toBe(0)
  })

  it('m1/m6 count every report, including several on the same day', () => {
    const rs = [report(), report({ ts: T0 + 1 }), report({ ts: T0 + 60_000 })]
    expect(progress('m1', rs)).toBe(3)
    expect(progress('m6', rs)).toBe(3)
  })

  it('m2 counts balanced taste, also when the time was off', () => {
    const rs = [
      report({ taste: 'balanced', diag: 'balanced' }),
      report({ taste: 'balanced', time: 40, diag: 'balanced_off' }),
      report({ taste: 'sour', diag: 'sour_ok' }),
    ]
    expect(progress('m2', rs)).toBe(2)
  })

  it('m3 counts distinct methods', () => {
    expect(progress('m3', [report(), report()])).toBe(1)
    expect(progress('m3', [report(), report({ method: 'filter' }), report({ method: 'filter' })])).toBe(2)
  })

  it('m4 counts distinct roasts, across methods', () => {
    expect(progress('m4', [report({ roast: 'light' }), report({ roast: 'light', method: 'filter' })])).toBe(1)
    const rs = [report({ roast: 'light' }), report({ roast: 'medium' }), report({ roast: 'dark', method: 'filter' })]
    expect(progress('m4', rs)).toBe(3)
  })

  it('m5 counts working recipes, not reports', () => {
    const r = report()
    expect(progress('m5', [r], {})).toBe(0)
    expect(progress('m5', [r], { 'espresso-medium': r.id })).toBe(1)
    expect(progress('m5', [r], { 'espresso-medium': r.id, 'filter-light': r.id })).toBe(2)
  })

  it('progress is independent of report order and timestamps', () => {
    const rs = [
      report({ ts: T0, method: 'filter', roast: 'light' }),
      report({ ts: T0 - DAY, taste: 'sour' }),
      report({ ts: T0 - 3 * DAY, roast: 'dark' }),
    ]
    for (const m of MISSIONS) {
      expect(m.progress([...rs].reverse(), {})).toBe(m.progress(rs, {}))
    }
  })
})

describe('progressFor', () => {
  const xpOf = (...ids: string[]) => ids.reduce((a, id) => a + MISSIONS.find((m) => m.id === id)!.xp, 0)

  it('starts empty', () => {
    const p = progressFor([], {})
    expect(p.xp).toBe(0)
    expect(p.rank.idx).toBe(0)
    expect(p.missions.every((m) => m.cur === 0 && !m.done)).toBe(true)
  })

  it('clamps progress at the goal', () => {
    const rs = Array.from({ length: 8 }, () => report())
    const m6 = progressFor(rs, {}).missions.find((m) => m.id === 'm6')!
    expect(m6).toMatchObject({ cur: 5, goal: 5, done: true })
  })

  it('adds XP per report plus each finished mission once', () => {
    // one balanced espresso: m1 and m2 done
    expect(progressFor([report()], {}).xp).toBe(REPORT_XP + xpOf('m1', 'm2'))
    // a second one finishes nothing new
    expect(progressFor([report(), report()], {}).xp).toBe(2 * REPORT_XP + xpOf('m1', 'm2'))
  })

  it('counts mission XP from working recipes too', () => {
    const r = report()
    expect(progressFor([r], { 'espresso-medium': r.id }).xp).toBe(REPORT_XP + xpOf('m1', 'm2', 'm5'))
  })

  it('derives rank from the total XP', () => {
    const rs = [
      report({ method: 'espresso', roast: 'light' }),
      report({ method: 'filter', roast: 'medium' }),
      report({ roast: 'dark' }),
      report(),
      report(),
    ]
    const p = progressFor(rs, { 'espresso-light': rs[0].id })
    // these reports finish the first six missions; the coffee and brewer ones need more
    const first = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']
    expect(p.missions.filter((m) => m.done).map((m) => m.id)).toEqual(first)
    expect(p.xp).toBe(5 * REPORT_XP + xpOf(...first))
    expect(p.rank).toEqual(rankFor(p.xp))
  })
})

describe('recipe content', () => {
  // a fresh, editable copy of the real content file
  const copy = () => structuredClone(content) as { recipes: Record<string, any>[] }
  const entry = (c: ReturnType<typeof copy>, slug: string) => c.recipes.find((e) => e.slug === slug)!

  it('the committed file is valid: espresso per roast, filter per brewer, old filter recipes archived', () => {
    expect(() => parseRecipeContent(content)).not.toThrow()
    expect(Object.keys(RECIPES).sort()).toEqual([
      'espresso-dark',
      'espresso-light',
      'espresso-medium',
      'filter-aeropress',
      'filter-dark',
      'filter-frenchpress',
      'filter-light',
      'filter-medium',
      'filter-v60',
    ])
    const filter = RECIPE_CONTENT.filter((e) => e.method === 'filter')
    expect(filter.filter((e) => e.status === 'published').map((e) => e.brewer).sort()).toEqual(['aeropress', 'frenchpress', 'v60'])
    expect(filter.filter((e) => e.roast).every((e) => e.status === 'archived')).toBe(true)
  })

  it('keeps steps and grind on brewer recipes only', () => {
    expect(RECIPES['filter-v60'].grind).toBe('medium_fine')
    expect(RECIPES['filter-v60'].steps?.[0]).toEqual({ at: 0, kind: 'bloom', to: 45 })
    expect(RECIPES['filter-frenchpress'].steps?.at(-1)).toEqual({ at: 300, kind: 'press' })
    expect(RECIPES['espresso-medium']).not.toHaveProperty('steps')
    expect(RECIPES['filter-light']).not.toHaveProperty('grind')
  })

  it('RECIPES uses the latest version and a stable id', () => {
    const c = copy()
    entry(c, 'espresso-medium').versions.push({ version: 2, publishedAt: '2026-11-01', dose: 19, yield: 38, time: [26, 31], temp: [92, 94] })
    const parsed = parseRecipeContent(c)
    const e = parsed.find((x) => x.slug === 'espresso-medium')!
    expect(e.versions.map((v) => v.id)).toEqual(['espresso-medium@1', 'espresso-medium@2'])
    expect(e.versions[1]).toMatchObject({ version: 2, dose: 19 })
  })

  it.each<[string, (c: ReturnType<typeof copy>) => void, RegExp]>([
    ['missing recipe', (c) => c.recipes.splice(0, 1), /espresso-light is missing/],
    ['missing brewer', (c) => c.recipes.splice(c.recipes.indexOf(entry(c, 'filter-aeropress')), 1), /filter-aeropress is missing/],
    ['duplicate recipe', (c) => c.recipes.push(structuredClone(c.recipes[0])), /espresso-light appears more than once/],
    ['slug not method-roast', (c) => (entry(c, 'filter-dark').slug = 'dark-filter'), /must be "filter-dark"/],
    ['slug not method-brewer', (c) => (entry(c, 'filter-v60').slug = 'filter-pourover'), /must be "filter-v60"/],
    ['unknown status', (c) => (entry(c, 'espresso-dark').status = 'draft'), /unknown status draft/],
    ['published per-roast filter', (c) => (entry(c, 'filter-dark').status = 'published'), /must be archived/],
    ['filter with roast and brewer', (c) => (entry(c, 'filter-v60').roast = 'light'), /needs a brewer/],
    ['espresso with a brewer', (c) => (entry(c, 'espresso-dark').brewer = 'v60'), /needs a roast and no brewer/],
    ['unknown brewer', (c) => (entry(c, 'filter-v60').brewer = 'chemex'), /unknown brewer chemex/],
    ['steps on espresso', (c) => (entry(c, 'espresso-dark').versions[0].steps = []), /grind and steps are for brewer recipes/],
    ['brewer without grind', (c) => delete entry(c, 'filter-v60').versions[0].grind, /grind must be one of/],
    ['brewer without steps', (c) => (entry(c, 'filter-v60').versions[0].steps = []), /steps must be/],
    ['unknown step', (c) => (entry(c, 'filter-v60').versions[0].steps[1].kind = 'dance'), /steps must be/],
    ['pour without a target', (c) => delete entry(c, 'filter-v60').versions[0].steps[2].to, /steps must be/],
    ['target on a stir', (c) => (entry(c, 'filter-aeropress').versions[0].steps[1].to = 10), /steps must be/],
    ['first step after 0', (c) => (entry(c, 'filter-v60').versions[0].steps[0].at = 5), /starts at 0/],
    ['steps out of order', (c) => (entry(c, 'filter-v60').versions[0].steps[3].at = 30), /in time order/],
    ['step after the time range', (c) => (entry(c, 'filter-frenchpress').versions[0].steps[3].at = 345), /before the end of the time range/],
    ['falling pour targets', (c) => (entry(c, 'filter-v60').versions[0].steps[2].to = 40), /must rise/],
    ['pours short of the yield', (c) => (entry(c, 'filter-v60').versions[0].yield = 260), /must reach the yield \(260 g\)/],
    ['no versions', (c) => (entry(c, 'filter-dark').versions = []), /at least one version/],
    ['version gap', (c) => (entry(c, 'filter-dark').versions[0].version = 2), /1, 2, 3/],
    ['bad date', (c) => (entry(c, 'filter-dark').versions[0].publishedAt = '26/10/2026'), /YYYY-MM-DD/],
    ['zero dose', (c) => (entry(c, 'filter-dark').versions[0].dose = 0), /dose must be/],
    ['inverted time range', (c) => (entry(c, 'filter-dark').versions[0].time = [165, 135]), /time must be/],
    ['temp not a pair', (c) => (entry(c, 'filter-dark').versions[0].temp = [90]), /temp must be/],
  ])('rejects %s', (_name, mutate, err) => {
    const c = copy()
    mutate(c)
    expect(() => parseRecipeContent(c)).toThrow(err)
  })
})

describe('rankFor', () => {
  it('starts at the first rank', () => {
    expect(rankFor(0)).toMatchObject({ idx: 0, cur: RANKS[0], next: RANKS[1], pct: 0 })
  })

  it('switches rank exactly at the threshold', () => {
    expect(rankFor(199).idx).toBe(0)
    expect(rankFor(200)).toMatchObject({ idx: 1, pct: 0 })
    expect(rankFor(350).pct).toBe(50)
  })

  it('caps at the last rank', () => {
    const last = RANKS[RANKS.length - 1]
    expect(rankFor(last.xp)).toMatchObject({ idx: RANKS.length - 1, next: null, pct: 100 })
    expect(rankFor(last.xp * 10).pct).toBe(100)
  })
})

describe('parseReportsResponse', () => {
  const body = (over: Record<string, unknown> = {}) => ({
    reports: [{ ...report({ id: 'a' }), recipeVersionId: 'espresso-medium@1' }, { ...report({ id: 'b' }), recipeVersionId: null }],
    working: { 'espresso-medium': 'a' },
    ...over,
  })

  it('accepts the API shape; a null recipeVersionId becomes a missing one', () => {
    const { reports, working } = parseReportsResponse(body())
    expect(reports.map((r) => r.id)).toEqual(['a', 'b'])
    expect(reports[0].recipeVersionId).toBe('espresso-medium@1')
    expect(reports[1]).not.toHaveProperty('recipeVersionId')
    expect(working).toEqual({ 'espresso-medium': 'a' })
  })

  it('accepts filter reports by brewer (roast null from the API) and older ones by roast', () => {
    const v60 = { ...report({ id: 'c', method: 'filter', brewer: 'v60' }), roast: null }
    const old = report({ id: 'd', method: 'filter', roast: 'light' })
    const [a, b] = parseReportsResponse(body({ reports: [v60, old] })).reports
    expect(a).toMatchObject({ method: 'filter', brewer: 'v60' })
    expect(a).not.toHaveProperty('roast')
    expect(b).toMatchObject({ method: 'filter', roast: 'light' })
    expect(b).not.toHaveProperty('brewer')
  })

  it('keeps grinder and notes; null or empty ones become missing', () => {
    const [a, b] = parseReportsResponse(body({ reports: [{ ...report({ id: 'a' }), grinder: '18', notes: 'ok' }, { ...report({ id: 'b' }), grinder: null, notes: '' }] })).reports
    expect(a).toMatchObject({ grinder: '18', notes: 'ok' })
    expect(b).not.toHaveProperty('grinder')
    expect(b).not.toHaveProperty('notes')
  })

  it('keeps the lot; a null lot becomes a missing one', () => {
    const [a, b] = parseReportsResponse(body({ reports: [{ ...report({ id: 'a' }), lot: 'peru-naranjo-yacu' }, { ...report({ id: 'b' }), lot: null }] })).reports
    expect(a.lot).toBe('peru-naranjo-yacu')
    expect(b).not.toHaveProperty('lot')
  })

  it('keeps the photo nonce; a missing or null photo stays missing', () => {
    const [a, b] = parseReportsResponse(body({ reports: [{ ...report({ id: 'a' }), photo: '0123456789abcdef' }, { ...report({ id: 'b' }), photo: null }] })).reports
    expect(a.photo).toBe('0123456789abcdef')
    expect(b).not.toHaveProperty('photo')
  })

  it('refuses a photo that is not a nonce, since it goes into a URL', () => {
    expect(() => parseReportsResponse(body({ reports: [{ ...report({ id: 'a' }), photo: '../../me' }] }))).toThrow('reports[0] is invalid')
  })

  it('keeps diag ids it does not know (older or newer builds)', () => {
    expect(parseReportsResponse(body({ reports: [report({ diag: 'future_id' })] })).reports[0].diag).toBe('future_id')
  })

  it('drops working entries that are not report ids', () => {
    expect(parseReportsResponse(body({ working: { 'espresso-medium': 'a', 'filter-dark': 3 } })).working).toEqual({ 'espresso-medium': 'a' })
  })

  it.each<[string, unknown]>([
    ['a missing body', null],
    ['no reports array', { working: {} }],
    ['no working object', { reports: [] }],
    ['working as an array', { reports: [], working: [] }],
    ['an unknown taste', { reports: [{ ...report(), taste: 'salty' }], working: {} }],
    ['a string dose', { reports: [{ ...report(), dose: '18' }], working: {} }],
    ['a numeric recipeVersionId', { reports: [{ ...report(), recipeVersionId: 1 }], working: {} }],
    ['a numeric lot', { reports: [{ ...report(), lot: 7 }], working: {} }],
    ['espresso without a roast', { reports: [{ ...report(), roast: null }], working: {} }],
    ['espresso with a brewer', { reports: [{ ...report(), brewer: 'v60' }], working: {} }],
    ['filter with neither roast nor brewer', { reports: [{ ...report({ method: 'filter' }), roast: null }], working: {} }],
    ['an unknown brewer', { reports: [{ ...report({ method: 'filter' }), brewer: 'chemex' }], working: {} }],
  ])('rejects %s', (_name, raw) => {
    expect(() => parseReportsResponse(raw)).toThrow(/GET \/api\/reports/)
  })
})

describe('feedReports', () => {
  it('keeps reports with a photo, newest first, without touching the input', () => {
    const old = report({ id: 'old', ts: T0 - DAY, photo: '0000000000000001' })
    const none = report({ id: 'none', ts: T0 })
    const now = report({ id: 'now', ts: T0 + 1, photo: '0000000000000002' })
    const input = [old, none, now]
    expect(feedReports(input).map((r) => r.id)).toEqual(['now', 'old'])
    expect(input.map((r) => r.id)).toEqual(['old', 'none', 'now'])
  })

  it('is empty when no report has a photo', () => {
    expect(feedReports([report()])).toEqual([])
  })
})

describe('diaryDays', () => {
  const utcDay = (ts: number) => new Date(ts).toISOString().slice(0, 10)

  it('is empty without reports', () => {
    expect(diaryDays([], utcDay)).toEqual([])
  })

  it('groups by day, newest day and newest report first, whatever the input order', () => {
    const a = report({ id: 'a', ts: T0 - DAY })
    const b = report({ id: 'b', ts: T0 })
    const c = report({ id: 'c', ts: T0 + 60_000 })
    const days = diaryDays([a, c, b], utcDay)
    expect(days.map((d) => d.day)).toEqual(['2026-10-26', '2026-10-25'])
    expect(days[0].reports.map((r) => r.id)).toEqual(['c', 'b'])
    expect(days[1].reports.map((r) => r.id)).toEqual(['a'])
  })

  it('does not reorder the input array', () => {
    const rs = [report({ id: 'old', ts: T0 }), report({ id: 'new', ts: T0 + 1 })]
    diaryDays(rs, utcDay)
    expect(rs.map((r) => r.id)).toEqual(['old', 'new'])
  })
})

describe('versionOf', () => {
  it('finds a version by its slug@version id', () => {
    expect(versionOf(RECIPE_CONTENT, 'filter-light@1')).toBe(RECIPES['filter-light'])
  })

  it('is undefined for older reports and unknown ids', () => {
    expect(versionOf(RECIPE_CONTENT, undefined)).toBeUndefined()
    expect(versionOf(RECIPE_CONTENT, 'filter-light@99')).toBeUndefined()
  })
})
