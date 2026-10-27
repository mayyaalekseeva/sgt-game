import { describe, expect, it } from 'vitest'
import { RECIPES, type Step } from './data'
import { elapsedSeconds, timerState } from './timer'

// filter-v60: bloom 0, swirl 10, pour 45, pour 75, swirl 105
const V60 = RECIPES['filter-v60'].steps as Step[]

describe('timerState', () => {
  it('starts on the first step, which is at 0', () => {
    expect(timerState(V60, 0)).toEqual({ current: 0, next: 1, toNext: 10 })
  })

  it('switches exactly at a step time', () => {
    expect(timerState(V60, 44.9)).toMatchObject({ current: 1, next: 2, toNext: 1 })
    expect(timerState(V60, 45)).toEqual({ current: 2, next: 3, toNext: 30 })
  })

  it('rounds the countdown up, so it never shows 0 before the step', () => {
    expect(timerState(V60, 74.2).toNext).toBe(1)
    expect(timerState(V60, 70).toNext).toBe(5)
  })

  it('has no next step once the last one started', () => {
    expect(timerState(V60, 105)).toEqual({ current: 4, next: null, toNext: 0 })
    expect(timerState(V60, 600)).toEqual({ current: 4, next: null, toNext: 0 })
  })

  it('is before the first step when the steps do not start at 0', () => {
    expect(timerState([{ at: 5, kind: 'stir' }], 2)).toEqual({ current: -1, next: 0, toNext: 3 })
  })

  it('takes the last of several steps at the same time', () => {
    const steps: Step[] = [{ at: 0, kind: 'pour', to: 200 }, { at: 0, kind: 'stir' }, { at: 30, kind: 'press' }]
    expect(timerState(steps, 0)).toEqual({ current: 1, next: 2, toNext: 30 })
  })

  it.each(Object.entries(RECIPES).filter(([, r]) => r.steps))('%s: walks every step in order', (_slug, r) => {
    const steps = r.steps as Step[]
    const seen: number[] = []
    for (let s = 0; s <= r.time[1]; s++) {
      const { current } = timerState(steps, s)
      if (seen.at(-1) !== current) seen.push(current)
    }
    // steps sharing a time are skipped over, never visited backwards
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(seen.at(-1)).toBe(steps.length - 1)
  })
})

describe('elapsedSeconds', () => {
  it('counts whole seconds and never goes negative', () => {
    expect(elapsedSeconds(1000, 1000)).toBe(0)
    expect(elapsedSeconds(1000, 1999)).toBe(0)
    expect(elapsedSeconds(1000, 2000)).toBe(1)
    expect(elapsedSeconds(1000, 181_500)).toBe(180)
    expect(elapsedSeconds(5000, 1000)).toBe(0)
  })
})
