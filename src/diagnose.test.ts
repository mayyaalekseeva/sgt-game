import { describe, expect, it } from 'vitest'
import { RECIPES, type Recipe, type Taste } from './data'
import { DIAG_IDS, diagnose, isDiagId, timeState, type DiagId } from './diagnose'

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
}

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

  it('reaches every DiagId', () => {
    const reached = new Set<DiagId>()
    for (const taste of ['sour', 'bitter', 'thin', 'balanced'] as Taste[]) {
      for (const time of [10, 27, 60]) {
        for (const yld of [R.yield, R.yield * 2]) reached.add(brew(taste, time, R.dose, yld))
      }
    }
    expect([...reached].sort()).toEqual(Object.keys(ALL).sort())
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
