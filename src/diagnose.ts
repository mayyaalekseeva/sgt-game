import { freshStage } from './coffees'
import type { BrewStyle, OffNote, Recipe, Taste } from './data'

export interface Input {
  dose: number
  yield: number
  time: number
  taste: Taste
  bloomed?: boolean // pour-over only; undefined counts as bloomed
  offNote?: OffNote
  daysOff?: number // days from the roast to the brew; undefined without a roast date
}

export type DiagId =
  | 'too_fresh'
  | 'green_under'
  | 'harsh_channel'
  | 'woody_fading'
  | 'woody_stale'
  | 'pour_harsh_uneven'
  | 'pour_woody_paper'
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
  | 'pour_no_bloom'
  | 'pour_sour_fast'
  | 'pour_sour_ok'
  | 'pour_sour_long'
  | 'pour_bitter_slow'
  | 'pour_bitter_ok'
  | 'pour_bitter_fast'
  | 'pour_thin_ratio'
  | 'pour_thin_fast'
  | 'pour_thin_ok'
  | 'steep_sour_short'
  | 'steep_sour_ok'
  | 'steep_sour_long'
  | 'steep_bitter_long'
  | 'steep_bitter_ok'
  | 'steep_bitter_short'
  | 'steep_thin_ratio'
  | 'steep_thin_short'
  | 'steep_thin_ok'

export const DIAG_IDS: DiagId[] = [
  'too_fresh',
  'green_under',
  'harsh_channel',
  'woody_fading',
  'woody_stale',
  'pour_harsh_uneven',
  'pour_woody_paper',
  'balanced',
  'balanced_off',
  'sour_fast',
  'sour_ok',
  'sour_long',
  'bitter_slow',
  'bitter_ok',
  'bitter_fast',
  'thin_yield',
  'thin_fast',
  'thin_ok',
  'pour_no_bloom',
  'pour_sour_fast',
  'pour_sour_ok',
  'pour_sour_long',
  'pour_bitter_slow',
  'pour_bitter_ok',
  'pour_bitter_fast',
  'pour_thin_ratio',
  'pour_thin_fast',
  'pour_thin_ok',
  'steep_sour_short',
  'steep_sour_ok',
  'steep_sour_long',
  'steep_bitter_long',
  'steep_bitter_ok',
  'steep_bitter_short',
  'steep_thin_ratio',
  'steep_thin_short',
  'steep_thin_ok',
]

// Stored reports (local or from the API) may carry a diag id this build no longer knows
export const isDiagId = (v: string): v is DiagId => DIAG_IDS.includes(v as DiagId)

export type TimeState = 'short' | 'ok' | 'long'

export function timeState(r: Recipe, time: number): TimeState {
  return time < r.time[0] ? 'short' : time > r.time[1] ? 'long' : 'ok'
}

// More than 10% more water (or espresso) per gram of coffee than the recipe
const tooDilute = (r: Recipe, i: Input) => i.yield / i.dose > (r.yield / r.dose) * 1.1

/**
 * An off-note comes before the taste. When the coffee's age explains it, the change is about the bag, not the
 * recipe: coffee still resting is full of CO2 that pushes the water around, so it tastes green or harsh whatever
 * the grind; after a month it loses its aromatics and turns woody. Otherwise green is under-extraction, harsh is
 * uneven extraction (channeling in espresso, a lopsided bed in pour-over) and woody in a fresh pour-over is the
 * paper. Null when the taste and time should decide.
 */
function offNoteDiag(brew: 'espresso' | BrewStyle, i: Input): DiagId | null {
  if (!i.offNote) return null
  const stage = i.daysOff == null || i.daysOff < 0 ? null : freshStage(i.daysOff, brew === 'espresso' ? 'espresso' : 'filter')
  switch (i.offNote) {
    case 'green':
      return stage === 'resting' ? 'too_fresh' : 'green_under'
    case 'harsh':
      if (stage === 'resting') return 'too_fresh'
      return brew === 'espresso' ? 'harsh_channel' : brew === 'pour' ? 'pour_harsh_uneven' : null
    case 'woody':
      if (stage === 'stale') return 'woody_stale'
      if (stage === 'fading') return 'woody_fading'
      return brew === 'pour' ? 'pour_woody_paper' : null
  }
}

/**
 * Rule-based espresso diagnosis. One taste symptom + time vs. the recipe range -> ONE change.
 * Thresholds are relative to the recipe range for the chosen roast level.
 */
export function diagnose(r: Recipe, i: Input): DiagId {
  const off = offNoteDiag('espresso', i)
  if (off) return off
  const ts = timeState(r, i.time)
  switch (i.taste) {
    case 'balanced':
      return ts === 'ok' ? 'balanced' : 'balanced_off'
    case 'sour':
      return ts === 'short' ? 'sour_fast' : ts === 'ok' ? 'sour_ok' : 'sour_long'
    case 'bitter':
      return ts === 'long' ? 'bitter_slow' : ts === 'ok' ? 'bitter_ok' : 'bitter_fast'
    case 'thin':
      if (tooDilute(r, i)) return 'thin_yield'
      return ts === 'short' ? 'thin_fast' : 'thin_ok'
  }
}

/**
 * Filter diagnosis, also ONE change. Pour-over: total time is how fast the bed drained, so it points at
 * grind and pouring; a skipped bloom comes first for sour or thin cups. Immersion: the brewer sets the
 * contact time, so time off the range means pressing early or late, and grind is the lever after that.
 */
export function diagnoseFilter(style: BrewStyle, r: Recipe, i: Input): DiagId {
  const off = offNoteDiag(style, i)
  if (off) return off
  const ts = timeState(r, i.time)
  if (i.taste === 'balanced') return ts === 'ok' ? 'balanced' : 'balanced_off'
  if (style === 'pour') {
    if (i.bloomed === false && i.taste !== 'bitter') return 'pour_no_bloom'
    switch (i.taste) {
      case 'sour':
        return ts === 'short' ? 'pour_sour_fast' : ts === 'ok' ? 'pour_sour_ok' : 'pour_sour_long'
      case 'bitter':
        return ts === 'long' ? 'pour_bitter_slow' : ts === 'ok' ? 'pour_bitter_ok' : 'pour_bitter_fast'
      case 'thin':
        if (tooDilute(r, i)) return 'pour_thin_ratio'
        return ts === 'short' ? 'pour_thin_fast' : 'pour_thin_ok'
    }
  }
  switch (i.taste) {
    case 'sour':
      return ts === 'short' ? 'steep_sour_short' : ts === 'ok' ? 'steep_sour_ok' : 'steep_sour_long'
    case 'bitter':
      return ts === 'long' ? 'steep_bitter_long' : ts === 'ok' ? 'steep_bitter_ok' : 'steep_bitter_short'
    case 'thin':
      if (tooDilute(r, i)) return 'steep_thin_ratio'
      return ts === 'short' ? 'steep_thin_short' : 'steep_thin_ok'
  }
}
