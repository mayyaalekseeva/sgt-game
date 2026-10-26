import type { Recipe, Taste } from './data'

export interface Input {
  dose: number
  yield: number
  time: number
  taste: Taste
}

export type DiagId =
  | 'balanced'
  | 'balanced_off'
  | 'sour_fast'
  | 'sour_ok'
  | 'sour_long'
  | 'bitter_slow'
  | 'bitter_ok'
  | 'bitter_fast'
  | 'thin_yield'
  | 'thin_fast'
  | 'thin_ok'

export type TimeState = 'short' | 'ok' | 'long'

export function timeState(r: Recipe, time: number): TimeState {
  return time < r.time[0] ? 'short' : time > r.time[1] ? 'long' : 'ok'
}

/**
 * Rule-based diagnosis. One taste symptom + time vs. the recipe range -> ONE change.
 * Thresholds are relative to the recipe range for the chosen roast level.
 */
export function diagnose(r: Recipe, i: Input): DiagId {
  const ts = timeState(r, i.time)
  switch (i.taste) {
    case 'balanced':
      return ts === 'ok' ? 'balanced' : 'balanced_off'
    case 'sour':
      return ts === 'short' ? 'sour_fast' : ts === 'ok' ? 'sour_ok' : 'sour_long'
    case 'bitter':
      return ts === 'long' ? 'bitter_slow' : ts === 'ok' ? 'bitter_ok' : 'bitter_fast'
    case 'thin': {
      const targetRatio = r.yield / r.dose
      const ratio = i.yield / i.dose
      if (ratio > targetRatio * 1.1) return 'thin_yield'
      return ts === 'short' ? 'thin_fast' : 'thin_ok'
    }
  }
}
