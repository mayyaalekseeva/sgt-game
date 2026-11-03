import { describe, expect, it } from 'vitest'
import type { Report } from './data'
import { fresh, momentsFor, parseCelebrated, showMoments, type Moment } from './moments'
import { progressFor } from './progress'

const T0 = Date.UTC(2026, 10, 3, 9, 0)
let n = 0
const report = (over: Partial<Report> = {}): Report => ({
  id: `r${++n}`,
  ts: T0 + n,
  method: 'espresso',
  roast: 'medium',
  dose: 18,
  yield: 36,
  time: 27,
  taste: 'sour',
  diag: 'sour_ok',
  lot: 'peru-naranjo-yacu',
  ...over,
})
const brews = (k: number) => Array.from({ length: k }, () => report())

describe('momentsFor', () => {
  it('celebrates the first report as a mission completed from an empty bar', () => {
    const before = progressFor([], {})
    const after = progressFor(brews(1), {})
    expect(momentsFor(before, after)).toEqual([{ kind: 'mission', id: 'mission:m1', mission: 'm1', xp: 50, from: 0 }])
  })

  it('starts a mission bar where it was before the report', () => {
    const four = brews(4)
    const ms = momentsFor(progressFor(four, {}), progressFor([...four, report()], {}))
    expect(ms).toEqual([{ kind: 'mission', id: 'mission:m6', mission: 'm6', xp: 100, from: 0.8 }])
  })

  it('has nothing to celebrate when a report earns only XP', () => {
    const two = brews(2)
    expect(momentsFor(progressFor(two, {}), progressFor([...two, report()], {}))).toEqual([])
  })

  it('celebrates a passed field test, once per drill', () => {
    const rs = brews(2)
    const before = progressFor(rs, {})
    const after = progressFor(rs, {}, { 'one-change': T0 })
    expect(momentsFor(before, after)).toEqual([{ kind: 'drill', id: 'drill:one-change', drill: 'one-change' }])
    expect(momentsFor(after, progressFor(rs, {}, { 'one-change': T0 + 1 }))).toEqual([])
  })

  it('puts a promotion last, with the new rank and its index', () => {
    // add reports until the rank changes, then look at that one step
    let rs: Report[] = []
    let ms: Moment[] = []
    while (progressFor(rs, {}).rank.idx === 0) {
      const next = [...rs, report({ method: rs.length % 2 ? 'filter' : 'espresso', roast: (['light', 'medium', 'dark'] as const)[rs.length % 3] })]
      ms = momentsFor(progressFor(rs, {}), progressFor(next, {}))
      rs = next
    }
    expect(ms.at(-1)).toEqual({ kind: 'rank', id: 'rank:cabo', rank: 'cabo', idx: 1 })
  })

  it('celebrates nothing when progress goes down (a report deleted)', () => {
    const rs = brews(5)
    expect(momentsFor(progressFor(rs, {}), progressFor(rs.slice(1), {}))).toEqual([])
  })
})

describe('fresh', () => {
  const a: Moment = { kind: 'drill', id: 'drill:ratio', drill: 'ratio' }
  const b: Moment = { kind: 'rank', id: 'rank:cabo', rank: 'cabo', idx: 1 }

  it('drops what was celebrated before, on this device', () => {
    expect(fresh([a, b], ['rank:cabo'])).toEqual([a])
  })

  it('keeps each event once', () => {
    expect(fresh([a, a, b], [])).toEqual([a, b])
  })
})

describe('parseCelebrated', () => {
  it('keeps the string ids and drops anything else', () => {
    expect(parseCelebrated(['rank:cabo', 3, null, 'mission:m1'])).toEqual(['rank:cabo', 'mission:m1'])
    expect(parseCelebrated({ 'rank:cabo': true })).toEqual([])
    expect(parseCelebrated(null)).toEqual([])
  })
})

describe('showMoments', () => {
  it('waits while a brew is timed or the timer screen is open', () => {
    expect(showMoments(false, false)).toBe(true)
    expect(showMoments(true, false)).toBe(false)
    expect(showMoments(false, true)).toBe(false)
  })
})
