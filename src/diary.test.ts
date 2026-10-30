import { describe, expect, it } from 'vitest'
import type { Report } from './data'
import { WEEK, brewChanges, diaryCoffees, diarySummary, lastWeek, previousBrews } from './diary'

const rep = (id: string, ts: number, over: Partial<Report> = {}): Report => ({
  id,
  ts,
  method: 'espresso',
  roast: 'medium',
  dose: 18,
  yield: 36,
  time: 28,
  taste: 'balanced',
  diag: 'balanced',
  ...over,
})

describe('diaryCoffees', () => {
  it('lists each coffee once, most recently brewed first, skipping reports without one', () => {
    const reports = [rep('a', 1, { lot: 'mutambu' }), rep('b', 3, { lot: 'cume' }), rep('c', 2, { lot: 'mutambu' }), rep('d', 4)]
    expect(diaryCoffees(reports)).toEqual(['cume', 'mutambu'])
  })

  it('is empty without coffees', () => {
    expect(diaryCoffees([rep('a', 1)])).toEqual([])
  })
})

describe('previousBrews', () => {
  it('links each brew to the one before it of the same coffee and recipe, whatever the input order', () => {
    const one = rep('1', 10, { lot: 'm' })
    const two = rep('2', 20, { lot: 'm' })
    const three = rep('3', 30, { lot: 'm' })
    const prev = previousBrews([three, one, two])
    expect(prev.get('3')).toBe(two)
    expect(prev.get('2')).toBe(one)
    expect(prev.has('1')).toBe(false)
  })

  it('keeps coffees apart', () => {
    const prev = previousBrews([rep('a', 1, { lot: 'm' }), rep('b', 2, { lot: 'c' })])
    expect(prev.size).toBe(0)
  })

  it('keeps recipes of one coffee apart: espresso and a V60 are different dial-ins', () => {
    const espresso = rep('e', 1, { lot: 'm' })
    const v60 = rep('v', 2, { lot: 'm', method: 'filter', roast: undefined, brewer: 'v60' })
    const espresso2 = rep('e2', 3, { lot: 'm' })
    const prev = previousBrews([espresso, v60, espresso2])
    expect(prev.has('v')).toBe(false)
    expect(prev.get('e2')).toBe(espresso)
  })

  it('links older reports without a coffee by recipe', () => {
    expect(previousBrews([rep('a', 1), rep('b', 2)]).get('b')?.id).toBe('a')
  })
})

describe('brewChanges', () => {
  const prev = rep('p', 1, { grinder: '14 clicks' })

  it('is empty for the same recipe', () => {
    expect(brewChanges(prev, rep('c', 2, { grinder: '14 clicks' }))).toEqual([])
  })

  it('gives signed deltas for dose, yield and time', () => {
    expect(brewChanges(prev, rep('c', 2, { dose: 18.5, yield: 34, time: 31 }))).toEqual([
      { field: 'dose', delta: 0.5 },
      { field: 'yield', delta: -2 },
      { field: 'time', delta: 3 },
    ])
  })

  it('rounds away float noise', () => {
    expect(brewChanges(rep('p', 1, { dose: 18.1 }), rep('c', 2, { dose: 18.3 }))).toEqual([{ field: 'dose', delta: 0.2 }])
  })

  it('names a grinder change only when both brews have a setting', () => {
    expect(brewChanges(prev, rep('c', 2, { grinder: '13 clicks' }))).toEqual([{ field: 'grinder', from: '14 clicks', to: '13 clicks' }])
    expect(brewChanges(prev, rep('c', 2))).toEqual([])
    expect(brewChanges(rep('p', 1), rep('c', 2, { grinder: '13' }))).toEqual([])
  })
})

describe('diarySummary and lastWeek', () => {
  const NOW = 1_000 * WEEK
  it('counts brews and balanced ones', () => {
    expect(diarySummary([rep('a', 1), rep('b', 2, { taste: 'sour' })])).toEqual({ brews: 2, balanced: 1 })
    expect(diarySummary([])).toEqual({ brews: 0, balanced: 0 })
  })

  it('keeps the last 7 days only', () => {
    const reports = [rep('old', NOW - WEEK), rep('edge', NOW - WEEK + 1), rep('now', NOW), rep('future', NOW + 1)]
    expect(lastWeek(reports, NOW).map((r) => r.id)).toEqual(['edge', 'now'])
  })
})
