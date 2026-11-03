import { describe, expect, it } from 'vitest'
import {
  FORMS,
  SCA_FORM,
  bandOf,
  cleanMarks,
  emptyMarks,
  formById,
  isOnScale,
  levelOf,
  maxTotal,
  scoreSample,
  stepScore,
  withCupCount,
  type ScaleAttribute,
  type SampleMarks,
} from './cupping'
import { translate, type Key } from './i18n'

const form = SCA_FORM
const scaleIds = form.attributes.filter((a) => a.kind === 'scale').map((a) => a.id)
const fragrance = form.attributes[0] as ScaleAttribute

function marks(score: number, over: Partial<SampleMarks> = {}): SampleMarks {
  const m = emptyMarks(form)
  for (const id of scaleIds) m.scores[id] = score
  return { ...m, ...over }
}

describe('SCA form definition', () => {
  it('has the ten attributes of the SCA form, seven on the 6-10 scale and three cup by cup', () => {
    expect(form.attributes.map((a) => a.id)).toEqual([
      'fragrance', 'flavor', 'aftertaste', 'acidity', 'body', 'balance', 'uniformity', 'clean_cup', 'sweetness', 'overall',
    ])
    expect(scaleIds).toHaveLength(7)
    for (const a of form.attributes) {
      if (a.kind === 'scale') expect([a.min, a.max, a.step]).toEqual([6, 10, 0.25])
      else expect(a.pointsPerCup).toBe(2)
    }
    expect(form.cups).toBe(5)
    expect(form.defects.intensity).toEqual({ taint: 2, fault: 4 })
    expect(maxTotal(form)).toBe(100)
  })

  it('labels every attribute, band and level in en and pt', () => {
    for (const f of FORMS) {
      const keys = [...f.attributes.map((a) => `cupping.attr.${a.id}`), ...f.bands.map((b) => `cupping.band.${b.id}`), ...f.levels.map((l) => `cupping.level.${l.id}`)]
      for (const k of keys) for (const lang of ['en', 'pt'] as const) expect(translate(lang, k as Key), `${lang} ${k}`).not.toBe(k)
    }
  })

  it('has unique form ids and finds a form by id', () => {
    expect(new Set(FORMS.map((f) => f.id)).size).toBe(FORMS.length)
    expect(formById('sca')).toBe(form)
    expect(formById('nope')).toBeUndefined()
  })
})

describe('scoring', () => {
  it('sums the attributes: all 10s and clean cups make 100, all 6s make 72', () => {
    expect(scoreSample(form, marks(10))).toMatchObject({ total: 100, defects: 0, final: 100, complete: true, band: 'outstanding' })
    // 7 x 6 + 3 x 10
    expect(scoreSample(form, marks(6)).final).toBe(72)
  })

  it('counts 2 points per cup for uniformity, clean cup and sweetness', () => {
    const m = marks(8)
    m.cups.uniformity = [true, true, false, true, true]
    m.cups.clean_cup = [false, false, true, true, true]
    // 7 x 8 + 8 + 6 + 10
    expect(scoreSample(form, m).total).toBe(80)
  })

  it('subtracts cups x intensity for each defect row: taint 2, fault 4', () => {
    const m = marks(8, { defects: [{ kind: 'taint', cups: 2 }, { kind: 'fault', cups: 1 }] })
    expect(scoreSample(form, m)).toMatchObject({ total: 86, defects: 8, final: 78, band: 'below_specialty' })
  })

  it('weights fewer cups so the best total is still 100, and says it is not the full count', () => {
    const three = withCupCount(form, marks(10), 3)
    expect(scoreSample(form, three)).toMatchObject({ total: 100, final: 100, fullCups: false })
    expect(scoreSample(form, marks(10)).fullCups).toBe(true)
    // one bad cup of three: 2 x 5/3 x 2 = 6.67 per attribute
    three.cups.clean_cup = [true, false, true]
    expect(scoreSample(form, three).total).toBe(96.67)
    // a taint in one cup of three counts as 5/3 cups: 3.33
    three.defects = [{ kind: 'taint', cups: 1 }]
    expect(scoreSample(form, three)).toMatchObject({ defects: 3.33, final: 93.33 })
    const one = withCupCount(form, marks(8), 1)
    one.defects = [{ kind: 'fault', cups: 1 }]
    expect(scoreSample(form, one)).toMatchObject({ total: 86, defects: 20, final: 66 })
  })

  it('reports what is not scored yet and keeps a live total of the rest', () => {
    const m = emptyMarks(form)
    m.scores.flavor = 8.5
    const s = scoreSample(form, m)
    expect(s.complete).toBe(false)
    expect(s.missing).toEqual(scaleIds.filter((id) => id !== 'flavor'))
    expect(s.total).toBe(38.5)
  })

  it('puts the final score in the SCA band at each edge', () => {
    expect(bandOf(form, 100)).toBe('outstanding')
    expect(bandOf(form, 90)).toBe('outstanding')
    expect(bandOf(form, 89.75)).toBe('excellent')
    expect(bandOf(form, 85)).toBe('excellent')
    expect(bandOf(form, 84.75)).toBe('very_good')
    expect(bandOf(form, 80)).toBe('very_good')
    expect(bandOf(form, 79.75)).toBe('below_specialty')
    expect(bandOf(form, -20)).toBe('below_specialty')
  })

  it('names the quality level of a single score', () => {
    expect([6, 6.75, 7, 7.75, 8, 8.75, 9, 9.75, 10].map((v) => levelOf(form, v))).toEqual([
      'good', 'good', 'very_good', 'very_good', 'excellent', 'excellent', 'outstanding', 'outstanding', 'outstanding',
    ])
  })
})

describe('stepper', () => {
  it('starts at 8, moves a quarter point and stops at 6 and 10', () => {
    expect(stepScore(fragrance, undefined, 1)).toBe(8)
    expect(stepScore(fragrance, 8, 1)).toBe(8.25)
    expect(stepScore(fragrance, 8, -1)).toBe(7.75)
    expect(stepScore(fragrance, 10, 1)).toBe(10)
    expect(stepScore(fragrance, 6, -1)).toBe(6)
  })

  it('only accepts quarter points from 6 to 10', () => {
    for (const v of [6, 6.25, 7.5, 9.75, 10]) expect(isOnScale(fragrance, v), String(v)).toBe(true)
    for (const v of [5.75, 10.25, 8.1, 0, NaN, Infinity, '8', null]) expect(isOnScale(fragrance, v), String(v)).toBe(false)
  })
})

describe('cleanMarks', () => {
  it('keeps valid marks as they are', () => {
    const m = marks(8.25, { defects: [{ kind: 'taint', cups: 1, flavor: 'off.rubbery' }] })
    m.cups.sweetness = [true, false, true, true, true]
    expect(cleanMarks(form, JSON.parse(JSON.stringify(m)))).toEqual(m)
  })

  it('drops off-scale scores and unknown attributes instead of guessing', () => {
    const m = cleanMarks(form, { scores: { flavor: 11, acidity: 8.1, body: '8', balance: 7.5, sparkle: 9 } })
    expect(m.scores).toEqual({ balance: 7.5 })
  })

  it('cuts or pads the per-cup lists to five cups', () => {
    const m = cleanMarks(form, { cups: { uniformity: [false, false, false, false, false, false, false], clean_cup: [false], sweetness: 'yes' } })
    expect(m.cups.uniformity).toEqual([false, false, false, false, false])
    expect(m.cups.clean_cup).toEqual([false, true, true, true, true])
    expect(m.cups.sweetness).toEqual([true, true, true, true, true])
  })

  it('keeps at most two defect rows with a known kind and 1-5 cups', () => {
    const m = cleanMarks(form, {
      defects: [
        { kind: 'taint', cups: 0 },
        { kind: 'mould', cups: 1 },
        { kind: 'fault', cups: 6 },
        { kind: 'fault', cups: 1.5 },
        { kind: 'taint', cups: 2, flavor: 'Not An Id' },
        null,
        { kind: 'fault', cups: 5 },
        { kind: 'taint', cups: 1 },
      ],
    })
    expect(m.defects).toEqual([{ kind: 'taint', cups: 2 }, { kind: 'fault', cups: 5 }])
  })

  it('keeps a cup count of 1-5, else uses 5, and checks defect cups against it', () => {
    expect(cleanMarks(form, { cupCount: 3, cups: { uniformity: [false] } }).cups.uniformity).toEqual([false, true, true])
    for (const n of [0, 6, 2.5, '3', null]) expect(cleanMarks(form, { cupCount: n }).cupCount, String(n)).toBe(5)
    expect(cleanMarks(form, { cupCount: 2, defects: [{ kind: 'taint', cups: 3 }, { kind: 'taint', cups: 2 }] }).defects).toEqual([{ kind: 'taint', cups: 2 }])
  })

  it('changes the cup count, keeping marks and capping defects', () => {
    const m = marks(8, { defects: [{ kind: 'fault', cups: 4 }] })
    m.cups.uniformity = [false, true, true, true, true]
    const two = withCupCount(form, m, 2)
    expect(two.cups.uniformity).toEqual([false, true])
    expect(two.defects).toEqual([{ kind: 'fault', cups: 2 }])
    expect(withCupCount(form, two, 4).cups.uniformity).toEqual([false, true, true, true])
    expect(withCupCount(form, m, 9)).toBe(m)
    expect(emptyMarks(form, 7).cupCount).toBe(5)
  })

  it('gives empty marks for anything that is not an object', () => {
    for (const v of [undefined, null, 'x', 3, []]) expect(cleanMarks(form, v)).toEqual(emptyMarks(form))
  })

  it('starts a sample unscored, with every cup marked', () => {
    const m = emptyMarks(form)
    expect(m.scores).toEqual({})
    expect(Object.keys(m.cups)).toEqual(['uniformity', 'clean_cup', 'sweetness'])
    expect(scoreSample(form, m)).toMatchObject({ total: 30, complete: false })
  })
})
