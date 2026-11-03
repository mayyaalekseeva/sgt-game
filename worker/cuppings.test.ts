import { describe, expect, it } from 'vitest'
import { MAX_SAMPLES, MAX_SESSIONS, isCuppingId, parseCuppingBatch, toCuppingsOut, toSampleRows, toSessionRow, type SessionIn } from './cuppings'

const NOW = Date.UTC(2026, 10, 3)
const ID = 'a'.repeat(32)
const marks = (over: Record<string, unknown> = {}) => ({
  cupCount: 5,
  scores: { flavor: 8.25, overall: 8 },
  cups: { uniformity: [true, true, true, true, false] },
  defects: [{ kind: 'taint', cups: 1, flavor: 'off.rubbery' }],
  ...over,
})
const sample = (over: Record<string, unknown> = {}) => ({ id: 'b'.repeat(32), form: 'sca', marks: marks(), ...over })
const session = (over: Record<string, unknown> = {}) => ({
  id: ID,
  day: '2026-11-03',
  status: 'draft',
  updatedAt: NOW - 1000,
  samples: [sample()],
  ...over,
})
const parse = (body: unknown) => parseCuppingBatch(body, NOW)
const errorOf = (body: unknown) => (parse(body) as { error?: string }).error

describe('parseCuppingBatch', () => {
  it('accepts a session and fills the optional fields', () => {
    expect(parse({ sessions: [session()] })).toEqual({
      sessions: [
        {
          id: ID,
          day: '2026-11-03',
          place: null,
          protocol: null,
          blind: false,
          revealed: false,
          status: 'draft',
          updatedAt: NOW - 1000,
          samples: [{ id: 'b'.repeat(32), lot: null, code: null, form: 'sca', ...marks(), flavors: null, notes: null }],
        },
      ],
    })
  })

  it('keeps a blind session with codes, a lot or my coffee, flavors and notes, trimmed', () => {
    const out = parse({
      sessions: [
        session({
          place: ' Lab ',
          protocol: '8.25 g / 150 ml',
          blind: true,
          revealed: true,
          status: 'done',
          samples: [
            sample({ code: ' A ', lot: 'yirgacheffe', flavors: ['fruity.berry'], notes: ' bright ' }),
            sample({ id: 'c'.repeat(32), lot: `my:${'d'.repeat(32)}` }),
          ],
        }),
      ],
    })
    expect(out).toMatchObject({
      sessions: [{ place: 'Lab', blind: true, revealed: true, status: 'done', samples: [{ code: 'A', lot: 'yirgacheffe', flavors: ['fruity.berry'], notes: 'bright' }, { lot: `my:${'d'.repeat(32)}` }] }],
    })
  })

  it('accepts a session with no samples yet', () => {
    expect(parse({ sessions: [session({ samples: [] })] })).toMatchObject({ sessions: [{ samples: [] }] })
  })

  it('checks the batch', () => {
    expect(errorOf(null)).toBeDefined()
    expect(errorOf({ sessions: [] })).toBeDefined()
    expect(errorOf({ sessions: Array.from({ length: MAX_SESSIONS + 1 }, () => session()) })).toBeDefined()
  })

  it.each([
    ['id', 'short'],
    ['day', '03/11/2026'],
    ['place', 'x'.repeat(61)],
    ['protocol', 'x'.repeat(281)],
    ['blind', 'yes'],
    ['status', 'final'],
    ['updatedAt', 1.5],
    ['updatedAt', NOW + 2 * 24 * 60 * 60 * 1000],
    ['samples', 'none'],
  ])('rejects a bad session %s (%s) and names it', (field, value) => {
    expect(errorOf({ sessions: [session(), session({ [field]: value })] })).toContain('sessions[1]')
  })

  it.each([
    ['id', 'x'],
    ['lot', 'Not A Slug'],
    ['code', 'x'.repeat(9)],
    ['form', 'SCA 2004'],
    ['marks', null],
    ['flavors', ['Bad']],
    ['flavors', ['sweet', 'sweet']],
    ['notes', 'x'.repeat(281)],
  ])('rejects a bad sample %s (%s)', (field, value) => {
    expect(errorOf({ sessions: [session({ samples: [sample({ [field]: value })] })] })).toContain('samples[0]')
  })

  it.each([
    ['cupCount', 0],
    ['cupCount', 11],
    ['scores', { flavor: -1 }],
    ['scores', { flavor: '8' }],
    ['scores', { 'Bad Key': 8 }],
    ['cups', { uniformity: [true, 'no'] }],
    ['cups', { uniformity: Array(11).fill(true) }],
    ['defects', [{ kind: 'taint', cups: 0 }]],
    ['defects', [{ kind: 'taint', cups: 1, flavor: 'Bad' }]],
    ['defects', Array(5).fill({ kind: 'taint', cups: 1 })],
  ])('rejects bad marks %s', (field, value) => {
    expect(errorOf({ sessions: [session({ samples: [sample({ marks: marks({ [field]: value }) })] })] })).toContain('marks')
  })

  it('takes a new form or attribute it does not know, as the client cleans marks', () => {
    expect(parse({ sessions: [session({ samples: [sample({ form: 'cva_descriptive', marks: marks({ scores: { new_thing: 5 } }) })] })] })).toHaveProperty('sessions')
  })

  it('refuses too many samples or a repeated sample id', () => {
    expect(errorOf({ sessions: [session({ samples: Array.from({ length: MAX_SAMPLES + 1 }, () => sample()) })] })).toBeDefined()
    expect(errorOf({ sessions: [session({ samples: [sample(), sample()] })] })).toContain('repeated')
  })

  it('checks ids', () => {
    expect(isCuppingId(ID)).toBe(true)
    expect(isCuppingId('A'.repeat(32))).toBe(false)
  })
})

describe('rows', () => {
  const [s] = (parse({ sessions: [session({ place: 'Lab', samples: [sample({ code: 'B', id: 'c'.repeat(32) }), sample({ code: 'A' })] })] }) as { sessions: SessionIn[] }).sessions

  it('round-trips through toCuppingsOut, samples in order', () => {
    const row = toSessionRow(s, 'u1', NOW)
    expect(row).toMatchObject({ userId: 'u1', createdAt: NOW, place: 'Lab' })
    const samples = toSampleRows(s, 'u1')
    expect(samples.map((x) => x.position)).toEqual([0, 1])
    const out = toCuppingsOut(
      [{ ...row, place: 'Lab', protocol: null, blind: false, revealed: false, status: 'draft', deletedAt: null, createdAt: NOW }],
      // stored out of order
      [...samples].reverse().map((x) => ({ ...x, lot: null, code: x.code ?? null, flavors: null, notes: null })),
    )
    expect(out).toEqual([
      {
        id: ID,
        day: '2026-11-03',
        place: 'Lab',
        blind: false,
        revealed: false,
        status: 'draft',
        updatedAt: NOW - 1000,
        samples: [
          { id: 'c'.repeat(32), code: 'B', form: 'sca', marks: marks() },
          { id: 'b'.repeat(32), code: 'A', form: 'sca', marks: marks() },
        ],
      },
    ])
  })

  it('sends a tombstone as id, deleted and updatedAt only', () => {
    const row = { ...toSessionRow(s, 'u1', NOW), place: null, protocol: null, blind: false, revealed: false, status: 'draft' as const, deletedAt: NOW, createdAt: NOW }
    expect(toCuppingsOut([row], [])).toEqual([{ id: ID, deleted: true, updatedAt: NOW - 1000 }])
  })
})
