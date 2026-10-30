import { describe, expect, it } from 'vitest'
import { MAX_BATCH, isReportId, parseReportBatch, parseReportEdit, toReportOut, toReportRows, type ReportIn } from './reports'

const NOW = Date.UTC(2026, 9, 27)

const report = (over: Record<string, unknown> = {}) => ({
  id: '3f6c1a2e-8b1d-4c3e-9f0a-1b2c3d4e5f60',
  ts: NOW - 60_000,
  method: 'espresso',
  roast: 'medium',
  brewer: null,
  dose: 18,
  yield: 36,
  time: 28,
  taste: 'balanced',
  diag: 'balanced',
  recipeVersionId: 'espresso-medium@1',
  lot: null,
  grinder: null,
  grinderModel: null,
  notes: null,
  timed: false,
  ...over,
})

const parse = (body: unknown) => parseReportBatch(body, NOW)

describe('parseReportBatch', () => {
  it('accepts a valid batch and defaults imported to false', () => {
    expect(parse({ reports: [report()] })).toEqual({ reports: [report()], imported: false })
    expect(parse({ reports: [report()], imported: true })).toMatchObject({ imported: true })
  })

  it('accepts old 8-char ids and reports without a recipe version', () => {
    const r = report({ id: 'k3x9a0b2', recipeVersionId: undefined })
    expect(parse({ reports: [r] })).toEqual({ reports: [{ ...r, recipeVersionId: null }], imported: false })
    expect(parse({ reports: [report({ recipeVersionId: null })] })).not.toHaveProperty('error')
  })

  it('drops fields it does not know', () => {
    const out = parse({ reports: [report({ extra: 'x', userId: 'someone-else' })] })
    expect('reports' in out && out.reports[0]).toEqual(report())
  })

  it('rejects a missing, empty or oversized batch', () => {
    expect(parse(null)).toHaveProperty('error')
    expect(parse({ reports: 'nope' })).toHaveProperty('error')
    expect(parse({ reports: [] })).toHaveProperty('error')
    expect(parse({ reports: Array.from({ length: MAX_BATCH + 1 }, (_, i) => report({ id: `r${i}` })) })).toHaveProperty('error')
    expect(parse({ reports: Array.from({ length: MAX_BATCH }, (_, i) => report({ id: `r${i}` })) })).not.toHaveProperty('error')
    expect(parse({ reports: [report()], imported: 'yes' })).toHaveProperty('error')
  })

  it('accepts filter reports by brewer, and older filter reports by roast', () => {
    const v60 = report({ method: 'filter', roast: null, brewer: 'v60', recipeVersionId: 'filter-v60@1' })
    expect(parse({ reports: [v60] })).toEqual({ reports: [v60], imported: false })
    const old = report({ method: 'filter', roast: 'light', recipeVersionId: 'filter-light@1' })
    expect(parse({ reports: [old] })).toEqual({ reports: [old], imported: false })
    // older clients leave brewer out entirely
    const { brewer: _, ...noBrewer } = report()
    expect(parse({ reports: [noBrewer] })).toEqual({ reports: [report()], imported: false })
  })

  it('keeps grinder and notes, and stores empty ones as null', () => {
    const r = report({ grinder: '18 clicks', notes: 'Fresh bag' })
    expect(parse({ reports: [r] })).toEqual({ reports: [r], imported: false })
    expect(parse({ reports: [report({ grinder: '', notes: '' })] })).toEqual({ reports: [report()], imported: false })
  })

  it('keeps a well-formed grinder id, listed or not, and nothing else', () => {
    const r = report({ grinderModel: 'comandante-c40' })
    expect(parse({ reports: [r] })).toEqual({ reports: [r], imported: false })
    expect(parse({ reports: [report({ grinderModel: 'some-new-grinder' })] })).not.toHaveProperty('error')
    // older clients leave it out
    const { grinderModel: _, ...none } = report()
    expect(parse({ reports: [none] })).toEqual({ reports: [report()], imported: false })
    for (const bad of ['Comandante C40', 'x'.repeat(41), 5, '']) {
      expect(parse({ reports: [report({ grinderModel: bad })] })).toEqual({ error: 'reports[0].grinderModel is invalid' })
    }
  })

  it('accepts a lot slug, and no lot from older clients', () => {
    const r = report({ lot: 'peru-naranjo-yacu' })
    expect(parse({ reports: [r] })).toEqual({ reports: [r], imported: false })
    const mine = report({ lot: 'my:' + 'a'.repeat(32) })
    expect(parse({ reports: [mine] })).toEqual({ reports: [mine], imported: false })
    const { lot: _, ...noLot } = report()
    expect(parse({ reports: [noLot] })).toEqual({ reports: [report()], imported: false })
  })

  it.each([
    ['id', ''],
    ['id', 'has space'],
    ['id', 'x'.repeat(65)],
    ['ts', NOW + 2 * 24 * 60 * 60 * 1000],
    ['ts', Date.UTC(2020, 0, 1)],
    ['ts', 1.5],
    ['method', 'aeropress'],
    ['roast', 'blonde'],
    ['roast', null],
    ['brewer', 'v60'],
    ['dose', 0],
    ['dose', Number.NaN],
    ['yield', '36'],
    ['time', 12.5],
    ['time', -1],
    ['taste', 'sweet'],
    ['diag', ''],
    ['recipeVersionId', 'espresso-medium'],
    ['recipeVersionId', 'espresso-medium@0'],
    ['lot', 'Peru Lot'],
    ['lot', 42],
    ['lot', 'my:short'],
    ['grinder', 'x'.repeat(31)],
    ['notes', 7],
    ['timed', 'yes'],
  ])('rejects a bad %s (%s) and names the report', (field, value) => {
    const out = parse({ reports: [report(), report({ [field]: value })] })
    expect(out).toHaveProperty('error')
    expect((out as { error: string }).error).toContain('reports[1]')
  })
})

describe('isReportId', () => {
  it('accepts client ids and rejects anything else', () => {
    expect(isReportId('k3x9a0b2')).toBe(true)
    expect(isReportId('3f6c1a2e-8b1d-4c3e-9f0a-1b2c3d4e5f60')).toBe(true)
    expect(isReportId('a/b')).toBe(false)
    expect(isReportId(42)).toBe(false)
  })
})

describe('toReportRows', () => {
  const batch = [report() as ReportIn, report({ id: 'b', recipeVersionId: 'filter-light@9' }) as ReportIn]
  const ctx = { userId: 'u1', knownVersions: new Set(['espresso-medium@1']), imported: false, now: NOW }

  it('maps yield to yieldG, sets the owner and keeps known versions only', () => {
    const rows = toReportRows(batch, ctx)
    expect(rows[0]).toMatchObject({ userId: 'u1', yieldG: 36, recipeVersionId: 'espresso-medium@1', importedAt: null, createdAt: NOW })
    expect(rows[0]).not.toHaveProperty('yield')
    expect(rows[1].recipeVersionId).toBeNull()
  })

  it('stamps importedAt on imported batches', () => {
    expect(toReportRows(batch, { ...ctx, imported: true }).every((r) => r.importedAt === NOW)).toBe(true)
  })

  const selected = (row: ReturnType<typeof toReportRows>[number]) => ({ ...row, roast: row.roast ?? null, brewer: row.brewer ?? null, recipeVersionId: row.recipeVersionId ?? null, lot: row.lot ?? null, grinder: row.grinder ?? null, grinderModel: row.grinderModel ?? null, notes: row.notes ?? null, timed: row.timed ?? false, photoKey: null, visibility: 'private' as const, editedAt: null, importedAt: null })

  it('round-trips through toReportOut', () => {
    const [row] = toReportRows([batch[0]], ctx)
    expect(toReportOut(selected(row))).toEqual({
      ...batch[0],
      timed: undefined,
    })
  })

  it('gives the photo nonce, never the R2 key or visibility', () => {
    const [row] = toReportRows([batch[0]], ctx)
    const out = toReportOut({ ...selected(row), photoKey: `photos/u1/${row.id}/0123456789abcdef.jpg` })
    expect(out).toMatchObject({ photo: '0123456789abcdef' })
    expect(out).not.toHaveProperty('photoKey')
    expect(out).not.toHaveProperty('visibility')
    expect(toReportOut(selected(row))).not.toHaveProperty('photo')
  })
})

describe('parseReportEdit', () => {
  const edit = (over: Record<string, unknown> = {}) => parseReportEdit({ grinder: '18 clicks', notes: 'Fresh bag', editedAt: NOW, ...over }, NOW)

  it('accepts grinder and notes, trimmed', () => {
    expect(edit({ grinder: ' 18 clicks ' })).toEqual({ grinder: '18 clicks', notes: 'Fresh bag', editedAt: NOW })
  })

  it('sets or clears the grinder, and leaves it alone when an older build leaves it out', () => {
    expect(edit({ grinderModel: 'niche-zero' })).toMatchObject({ grinderModel: 'niche-zero' })
    expect(edit({ grinderModel: '' })).toMatchObject({ grinderModel: null })
    expect(edit({ grinderModel: null })).toMatchObject({ grinderModel: null })
    expect(edit()).not.toHaveProperty('grinderModel')
    expect(edit({ grinderModel: 'Niche Zero' })).toEqual({ error: 'grinderModel is invalid' })
  })

  it('clears a field sent empty, blank or null', () => {
    expect(edit({ grinder: '', notes: '   ' })).toEqual({ grinder: null, notes: null, editedAt: NOW })
    expect(edit({ grinder: null, notes: undefined })).toMatchObject({ grinder: null, notes: null })
  })

  it('refuses long text, wrong types and a bad editedAt', () => {
    expect(edit({ grinder: 'x'.repeat(31) })).toEqual({ error: 'grinder is invalid' })
    expect(edit({ notes: 'x'.repeat(281) })).toEqual({ error: 'notes is invalid' })
    expect(edit({ notes: 5 })).toEqual({ error: 'notes is invalid' })
    expect(edit({ editedAt: NOW + 2 * 24 * 3600_000 })).toEqual({ error: 'editedAt is out of range' })
    expect(edit({ editedAt: '1' })).toEqual({ error: 'editedAt is out of range' })
    expect(parseReportEdit(null, NOW)).toEqual({ error: 'expected { grinder, notes, editedAt }' })
  })

  it('never takes numbers or taste', () => {
    expect(edit({ dose: 99, taste: 'sour' })).not.toHaveProperty('dose')
  })
})
