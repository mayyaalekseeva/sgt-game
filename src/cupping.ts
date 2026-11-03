// Cupping, based on the SCA cupping form (the classic 100-point form). Not SCA-certified, no Q-grade.
// Every number here is checked against the SCAA protocol and form: see docs/cupping-research.md.
// The form is data, so another form (the CVA ones) is a new FormDef, not a rewrite. A stored sample names its form id,
// so never change a published form's numbers: add a new form instead.
// Labels are in src/i18n.ts as cupping.attr.<id>, cupping.band.<id> and cupping.level.<id>.

import { isFlavorId } from './flavors'

/** Scored once per sample on a quality scale. */
export interface ScaleAttribute {
  id: string
  kind: 'scale'
  min: number
  max: number
  step: number
}

/** Judged cup by cup: each cup that shows the attribute earns pointsPerCup. */
export interface CupsAttribute {
  id: string
  kind: 'cups'
  pointsPerCup: number
}

export type Attribute = ScaleAttribute | CupsAttribute

export type DefectKind = 'taint' | 'fault'

export interface FormDef {
  id: string
  cups: number
  attributes: Attribute[]
  defects: {
    intensity: Record<DefectKind, number> // subtracted per affected cup
    maxRows: number
  }
  bands: { id: string; min: number }[] // highest first; the first band whose min the final score reaches
  levels: { id: string; min: number }[] // the quality level of one scale score, highest first
}

const scale = (id: string): ScaleAttribute => ({ id, kind: 'scale', min: 6, max: 10, step: 0.25 })
const perCup = (id: string): CupsAttribute => ({ id, kind: 'cups', pointsPerCup: 2 })

// Protocol p. 5-10. The quality table ends at 9.75, the form's tick marks at 10; 10 is allowed (decided 2026-11-03).
// Scores start at 6 like the form. Up to two defect rows a sample, summed (the form has one row; decided 2026-11-03).
export const SCA_FORM: FormDef = {
  id: 'sca',
  cups: 5,
  attributes: [
    scale('fragrance'),
    scale('flavor'),
    scale('aftertaste'),
    scale('acidity'),
    scale('body'),
    scale('balance'),
    perCup('uniformity'),
    perCup('clean_cup'),
    perCup('sweetness'),
    scale('overall'),
  ],
  defects: { intensity: { taint: 2, fault: 4 }, maxRows: 2 },
  bands: [
    { id: 'outstanding', min: 90 },
    { id: 'excellent', min: 85 },
    { id: 'very_good', min: 80 },
    { id: 'below_specialty', min: -Infinity },
  ],
  levels: [
    { id: 'outstanding', min: 9 },
    { id: 'excellent', min: 8 },
    { id: 'very_good', min: 7 },
    { id: 'good', min: 6 },
  ],
}

export const FORMS: FormDef[] = [SCA_FORM]

export const formById = (id: string): FormDef | undefined => FORMS.find((f) => f.id === id)

export interface Defect {
  kind: DefectKind
  cups: number // how many cups showed it, 1..form.cups
  flavor?: string // what it tasted like, a src/flavors.ts id
}

/** One sample's marks. A scale attribute that is missing is not scored yet. */
export interface SampleMarks {
  scores: Record<string, number>
  cups: Record<string, boolean[]> // per-cup attributes, one entry per cup
  defects: Defect[]
}

/** A fresh sample: nothing scored, every cup marked as showing the attribute, as cuppers start from 10. */
export function emptyMarks(form: FormDef): SampleMarks {
  const cups: Record<string, boolean[]> = {}
  for (const a of form.attributes) if (a.kind === 'cups') cups[a.id] = Array<boolean>(form.cups).fill(true)
  return { scores: {}, cups, defects: [] }
}

export function isOnScale(a: ScaleAttribute, v: unknown): v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < a.min || v > a.max) return false
  const steps = (v - a.min) / a.step
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

/** One stepper tap: the next value on the scale, from the midpoint-ish start when not scored yet. */
export function stepScore(a: ScaleAttribute, current: number | undefined, dir: 1 | -1, start = 8): number {
  if (current === undefined) return Math.min(a.max, Math.max(a.min, start))
  return Math.min(a.max, Math.max(a.min, current + dir * a.step))
}

/**
 * Stored or sent marks made safe for this form: off-scale scores are dropped (unscored), per-cup lists are cut or
 * padded to the form's cups, defects need a known kind and 1..cups cups, at most maxRows of them. Unknown attribute
 * ids are dropped.
 */
export function cleanMarks(form: FormDef, v: unknown): SampleMarks {
  const out = emptyMarks(form)
  if (!v || typeof v !== 'object') return out
  const raw = v as { scores?: unknown; cups?: unknown; defects?: unknown }
  const scores = raw.scores && typeof raw.scores === 'object' ? (raw.scores as Record<string, unknown>) : {}
  const cups = raw.cups && typeof raw.cups === 'object' ? (raw.cups as Record<string, unknown>) : {}
  for (const a of form.attributes) {
    if (a.kind === 'scale') {
      const s = scores[a.id]
      if (isOnScale(a, s)) out.scores[a.id] = s
    } else {
      const list = cups[a.id]
      if (Array.isArray(list)) out.cups[a.id] = out.cups[a.id].map((d, i) => (typeof list[i] === 'boolean' ? (list[i] as boolean) : d))
    }
  }
  if (Array.isArray(raw.defects)) {
    for (const d of raw.defects) {
      if (out.defects.length >= form.defects.maxRows) break
      if (!d || typeof d !== 'object') continue
      const { kind, cups: n, flavor } = d as Record<string, unknown>
      if (kind !== 'taint' && kind !== 'fault') continue
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > form.cups) continue
      out.defects.push(isFlavorId(flavor) ? { kind, cups: n, flavor } : { kind, cups: n })
    }
  }
  return out
}

export interface SampleScore {
  total: number // sum of the attribute scores ("Total Score")
  defects: number // points subtracted
  final: number // total - defects ("Final Score")
  complete: boolean // every scale attribute scored
  missing: string[] // scale attribute ids not scored yet
  band: string // the final score's band id; meaningful only when complete
}

export function attributeScore(form: FormDef, marks: SampleMarks, a: Attribute): number | undefined {
  if (a.kind === 'scale') return marks.scores[a.id]
  return (marks.cups[a.id] ?? []).slice(0, form.cups).filter(Boolean).length * a.pointsPerCup
}

export const defectPoints = (form: FormDef, defects: Defect[]) =>
  defects.reduce((sum, d) => sum + d.cups * form.defects.intensity[d.kind], 0)

export const bandOf = (form: FormDef, final: number) => (form.bands.find((b) => final >= b.min) ?? form.bands[form.bands.length - 1]).id

export const levelOf = (form: FormDef, score: number) => (form.levels.find((l) => score >= l.min) ?? form.levels[form.levels.length - 1]).id

/** The live total. Expects marks from cleanMarks or the UI; unscored scale attributes count as 0 until scored. */
export function scoreSample(form: FormDef, marks: SampleMarks): SampleScore {
  let total = 0
  const missing: string[] = []
  for (const a of form.attributes) {
    const s = attributeScore(form, marks, a)
    if (s === undefined) missing.push(a.id)
    else total += s
  }
  const defects = defectPoints(form, marks.defects)
  const final = total - defects
  return { total, defects, final, complete: missing.length === 0, missing, band: bandOf(form, final) }
}

/** The best possible total, for a progress bar: 100 on the SCA form. */
export const maxTotal = (form: FormDef) =>
  form.attributes.reduce((sum, a) => sum + (a.kind === 'scale' ? a.max : a.pointsPerCup * form.cups), 0)
