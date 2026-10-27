import { describe, expect, it } from 'vitest'
import { RECIPES, type Recipe, type Taste } from './data'
import { DIAG_IDS, diagnose, diagnoseFilter, isDiagId, timeState, type DiagId } from './diagnose'

// espresso-medium: 18 g -> 36 g (ratio 2.0), 25-30 s
const R = RECIPES['espresso-medium']
const brew = (taste: Taste, time: number, dose = R.dose, yld = R.yield) =>
  diagnose(R, { dose, yield: yld, time, taste })

// Record<DiagId, ...> fails to typecheck when a DiagId is added or removed
const ALL: Record<DiagId, true> = {
  balanced: true,
  balanced_off: true,
  sour_fast: true,
  sour_ok: true,
  sour_long: true,
  bitter_slow: true,
  bitter_ok: true,
  bitter_fast: true,
  thin_yield: true,
  thin_fast: true,
  thin_ok: true,
  pour_no_bloom: true,
  pour_sour_fast: true,
  pour_sour_ok: true,
  pour_sour_long: true,
  pour_bitter_slow: true,
  pour_bitter_ok: true,
  pour_bitter_fast: true,
  pour_thin_ratio: true,
  pour_thin_fast: true,
  pour_thin_ok: true,
  steep_sour_short: true,
  steep_sour_ok: true,
  steep_sour_long: true,
  steep_bitter_long: true,
  steep_bitter_ok: true,
  steep_bitter_short: true,
  steep_thin_ratio: true,
  steep_thin_short: true,
  steep_thin_ok: true,
}
const ids = (prefix: string) => (Object.keys(ALL) as DiagId[]).filter((id) => id.startsWith(prefix))
const SHARED: DiagId[] = ['balanced', 'balanced_off']

describe('timeState', () => {
  // the range is inclusive on both ends, for every recipe
  it.each(Object.entries(RECIPES))('%s: boundaries', (_key, r: Recipe) => {
    const [lo, hi] = r.time
    expect(timeState(r, lo - 1)).toBe('short')
    expect(timeState(r, lo - 0.5)).toBe('short')
    expect(timeState(r, lo)).toBe('ok')
    expect(timeState(r, hi)).toBe('ok')
    expect(timeState(r, hi + 0.5)).toBe('long')
    expect(timeState(r, hi + 1)).toBe('long')
  })
})

describe('diagnose', () => {
  it.each<[Taste, number, DiagId]>([
    ['balanced', 24, 'balanced_off'],
    ['balanced', 25, 'balanced'],
    ['balanced', 30, 'balanced'],
    ['balanced', 31, 'balanced_off'],
    ['sour', 24, 'sour_fast'],
    ['sour', 25, 'sour_ok'],
    ['sour', 30, 'sour_ok'],
    ['sour', 31, 'sour_long'],
    ['bitter', 24, 'bitter_fast'],
    ['bitter', 25, 'bitter_ok'],
    ['bitter', 30, 'bitter_ok'],
    ['bitter', 31, 'bitter_slow'],
    ['thin', 24, 'thin_fast'],
    ['thin', 25, 'thin_ok'],
    ['thin', 30, 'thin_ok'],
    ['thin', 31, 'thin_ok'],
  ])('%s at %i s -> %s', (taste, time, want) => {
    expect(brew(taste, time)).toBe(want)
  })

  describe('thin_yield threshold (ratio more than 10% over target)', () => {
    it('is exclusive at exactly +10%', () => {
      // 20 g dose, target ratio 2.0 -> 44 g is exactly 2.2
      expect(brew('thin', 27, 20, 44)).toBe('thin_ok')
      expect(brew('thin', 27, 20, 45)).toBe('thin_yield')
    })

    it('compares ratio, not absolute yield', () => {
      // 18 g: threshold 39.6 g
      expect(brew('thin', 27, 18, 39)).toBe('thin_ok')
      expect(brew('thin', 27, 18, 40)).toBe('thin_yield')
      // 40 g out is over for 18 g in, but fine for a 20 g dose
      expect(brew('thin', 27, 20, 40)).toBe('thin_ok')
    })

    it('wins over time state', () => {
      expect(brew('thin', 10, 18, 50)).toBe('thin_yield')
      expect(brew('thin', 60, 18, 50)).toBe('thin_yield')
    })

    it('only applies to thin', () => {
      expect(brew('sour', 27, 18, 50)).toBe('sour_ok')
      expect(brew('bitter', 27, 18, 50)).toBe('bitter_ok')
      expect(brew('balanced', 27, 18, 50)).toBe('balanced')
    })

    it.each(Object.entries(RECIPES))('%s: boundary at target yield x 1.1', (_key, r: Recipe) => {
      // r.yield * 1.1 drifts in floating point (225 * 1.1 = 247.50000000000003); use the decimal value
      const limit = (r.yield * 11) / 10
      const t = r.time[0]
      expect(diagnose(r, { dose: r.dose, yield: limit, time: t, taste: 'thin' })).not.toBe('thin_yield')
      expect(diagnose(r, { dose: r.dose, yield: limit + 0.5, time: t, taste: 'thin' })).toBe('thin_yield')
    })
  })

  it('reaches every espresso DiagId', () => {
    const reached = new Set<DiagId>()
    for (const taste of ['sour', 'bitter', 'thin', 'balanced'] as Taste[]) {
      for (const time of [10, 27, 60]) {
        for (const yld of [R.yield, R.yield * 2]) reached.add(brew(taste, time, R.dose, yld))
      }
    }
    expect([...reached].sort()).toEqual((Object.keys(ALL) as DiagId[]).filter((id) => !/^(pour|steep)_/.test(id)).sort())
  })
})

describe('diagnoseFilter', () => {
  // filter-v60: 15 g -> 250 g (ratio 16.7), 2:45-3:30; filter-frenchpress: 30 g -> 500 g, 5:00-5:45
  const V60 = RECIPES['filter-v60']
  const FP = RECIPES['filter-frenchpress']
  const pour = (taste: Taste, time: number, bloomed = true, water = V60.yield) =>
    diagnoseFilter('pour', V60, { dose: V60.dose, yield: water, time, taste, bloomed })
  const steep = (taste: Taste, time: number, water = FP.yield) => diagnoseFilter('steep', FP, { dose: FP.dose, yield: water, time, taste })

  it.each<[Taste, number, DiagId]>([
    ['balanced', 164, 'balanced_off'],
    ['balanced', 165, 'balanced'],
    ['balanced', 211, 'balanced_off'],
    ['sour', 150, 'pour_sour_fast'],
    ['sour', 180, 'pour_sour_ok'],
    ['sour', 240, 'pour_sour_long'],
    ['bitter', 150, 'pour_bitter_fast'],
    ['bitter', 210, 'pour_bitter_ok'],
    ['bitter', 240, 'pour_bitter_slow'],
    ['thin', 150, 'pour_thin_fast'],
    ['thin', 180, 'pour_thin_ok'],
    ['thin', 240, 'pour_thin_ok'],
  ])('pour-over: %s at %i s -> %s', (taste, time, want) => {
    expect(pour(taste, time)).toBe(want)
  })

  it('a skipped bloom comes first for sour and thin cups, not for bitter or balanced ones', () => {
    expect(pour('sour', 150, false)).toBe('pour_no_bloom')
    expect(pour('thin', 240, false)).toBe('pour_no_bloom')
    expect(pour('bitter', 240, false)).toBe('pour_bitter_slow')
    expect(pour('balanced', 180, false)).toBe('balanced')
    // undefined means the screen did not ask: treat as bloomed
    expect(diagnoseFilter('pour', V60, { dose: 15, yield: 250, time: 180, taste: 'sour' })).toBe('pour_sour_ok')
  })

  it.each<[Taste, number, DiagId]>([
    ['balanced', 300, 'balanced'],
    ['balanced', 240, 'balanced_off'],
    ['sour', 240, 'steep_sour_short'],
    ['sour', 320, 'steep_sour_ok'],
    ['sour', 400, 'steep_sour_long'],
    ['bitter', 240, 'steep_bitter_short'],
    ['bitter', 345, 'steep_bitter_ok'],
    ['bitter', 346, 'steep_bitter_long'],
    ['thin', 240, 'steep_thin_short'],
    ['thin', 320, 'steep_thin_ok'],
    ['thin', 400, 'steep_thin_ok'],
  ])('immersion: %s at %i s -> %s', (taste, time, want) => {
    expect(steep(taste, time)).toBe(want)
  })

  it('ignores the bloom answer for immersion', () => {
    expect(diagnoseFilter('steep', FP, { dose: 30, yield: 500, time: 320, taste: 'sour', bloomed: false })).toBe('steep_sour_ok')
  })

  it('flags too much water by ratio, over time', () => {
    // 15 g: 1.1 x 16.67 -> 275 g is the limit
    expect(pour('thin', 150, true, 275)).toBe('pour_thin_fast')
    expect(pour('thin', 150, true, 280)).toBe('pour_thin_ratio')
    // 30 g: limit 550 g
    expect(steep('thin', 240, 550)).toBe('steep_thin_short')
    expect(steep('thin', 240, 560)).toBe('steep_thin_ratio')
  })

  it('reaches every pour-over and immersion DiagId', () => {
    const p = new Set<DiagId>()
    const s = new Set<DiagId>()
    for (const taste of ['sour', 'bitter', 'thin', 'balanced'] as Taste[]) {
      for (const time of [60, 180, 600]) {
        for (const bloomed of [true, false]) for (const water of [250, 400]) p.add(pour(taste, time, bloomed, water))
        for (const water of [500, 800]) s.add(steep(taste, time === 180 ? 320 : time, water))
      }
    }
    expect([...p].sort()).toEqual([...SHARED, ...ids('pour_')].sort())
    expect([...s].sort()).toEqual([...SHARED, ...ids('steep_')].sort())
  })
})

describe('DIAG_IDS', () => {
  it('lists every DiagId exactly once', () => {
    expect([...DIAG_IDS].sort()).toEqual(Object.keys(ALL).sort())
  })

  it('isDiagId rejects ids this build does not know', () => {
    expect(isDiagId('sour_fast')).toBe(true)
    expect(isDiagId('sour_too_fast')).toBe(false)
    expect(isDiagId('')).toBe(false)
  })
})
