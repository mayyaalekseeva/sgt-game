import { describe, expect, it } from 'vitest'
import { emptyMarks, SCA_FORM } from './cupping'
import {
  MAX_SAMPLES,
  deletedIds,
  mergeSessions,
  namesHidden,
  newSample,
  newSession,
  nextCode,
  parseSample,
  parseSession,
  parseSessions,
  type CuppingSession,
} from './cuppings'

const id = (c: string) => c.repeat(32)
const session = (over: Partial<CuppingSession> = {}): CuppingSession => ({ ...newSession(id('a'), 10, () => '2026-11-03'), ...over })

describe('cupping sessions', () => {
  it('starts a draft for today with no samples, names shown', () => {
    expect(newSession(id('a'), 10, () => '2026-11-03')).toEqual({ id: id('a'), day: '2026-11-03', blind: false, revealed: false, status: 'draft', updatedAt: 10, samples: [] })
    expect(newSample(id('b'))).toEqual({ id: id('b'), form: 'sca', marks: emptyMarks(SCA_FORM) })
    expect(newSample(id('b'), SCA_FORM, 3).marks.cupCount).toBe(3)
  })

  it('round-trips a full session through storage', () => {
    const s = session({
      place: 'Lab',
      protocol: '8.25 g / 150 ml',
      blind: true,
      status: 'done',
      samples: [{ ...newSample(id('b')), lot: 'yirgacheffe', code: 'A', flavors: ['fruity.berry'], notes: 'bright' }],
    })
    s.samples[0].marks.scores.flavor = 8.5
    s.samples[0].marks.defects = [{ kind: 'taint', cups: 1 }]
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('reads what the server sends', () => {
    const raw = { id: id('a'), day: '2026-11-03', blind: false, revealed: false, status: 'draft', updatedAt: 10, samples: [{ id: id('b'), form: 'sca', marks: { cupCount: 5, scores: { flavor: 8 }, cups: {}, defects: [] } }] }
    expect(parseSession(raw)?.samples[0].marks.scores).toEqual({ flavor: 8 })
  })

  it('cleans marks of a known form, and keeps those of a form this build does not know', () => {
    const known = parseSample({ id: id('b'), form: 'sca', marks: { cupCount: 9, scores: { flavor: 12, body: 7 } } })
    expect(known?.marks).toMatchObject({ cupCount: 5, scores: { body: 7 } })
    const foreign = { cupCount: 5, scores: { sweetness_intensity: 4 }, cups: {}, defects: [] }
    expect(parseSample({ id: id('b'), form: 'cva_affective', marks: foreign })?.marks).toEqual(foreign)
    expect(parseSample({ id: id('b'), form: 'cva_affective', marks: { scores: {} } })).toBeNull()
  })

  it('drops bad samples and sessions, and server tombstones', () => {
    expect(parseSample({ id: 'x', form: 'sca' })).toBeNull()
    expect(parseSample({ id: id('b') })).toBeNull()
    expect(parseSample({ id: id('b'), form: 'sca', lot: 'Bad Lot', code: 'x'.repeat(9) })).toEqual(newSample(id('b')))
    expect(parseSession({ ...session(), day: '3/11' })).toBeNull()
    expect(parseSession({ ...session(), updatedAt: 'now' })).toBeNull()
    expect(parseSession({ ...session(), status: 'weird' })?.status).toBe('draft')
    const tomb = { id: id('c'), deleted: true, updatedAt: 3 }
    expect(parseSessions([session(), tomb, null, 'x'])).toEqual([session()])
    expect(deletedIds([session(), tomb, null])).toEqual([id('c')])
    const many = session({ samples: Array.from({ length: MAX_SAMPLES + 2 }, (_, i) => newSample(i.toString(16).padStart(32, '0'))) })
    expect(parseSession(many)?.samples).toHaveLength(MAX_SAMPLES)
  })

  it('merges copies, the newer winning, newest day first', () => {
    const a = session()
    const b = session({ id: id('b'), day: '2026-11-04' })
    const merged = mergeSessions([a, b], [{ ...a, place: 'Lab', updatedAt: 11 }, { ...b, place: 'Old', updatedAt: 1 }])
    expect(merged.map((s) => [s.id, s.place])).toEqual([[id('b'), undefined], [id('a'), 'Lab']])
  })

  it('gives the next free blind code', () => {
    expect(nextCode(session())).toBe('A')
    expect(nextCode(session({ samples: [{ ...newSample(id('b')), code: 'A' }, { ...newSample(id('c')), code: 'C' }] }))).toBe('B')
  })

  it('hides names only in a blind session not yet revealed', () => {
    expect(namesHidden(session())).toBe(false)
    expect(namesHidden(session({ blind: true }))).toBe(true)
    expect(namesHidden(session({ blind: true, revealed: true }))).toBe(false)
  })
})
