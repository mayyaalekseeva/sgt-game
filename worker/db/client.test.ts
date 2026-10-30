import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { describe, expect, it } from 'vitest'
import { toCoffeeRow } from '../coffees'
import { toReportRows, type ReportIn } from '../reports'
import { D1_MAX_PARAMS, rowsPerInsert } from './client'
import { coffees, reports } from './schema'

// Builds the SQL the routes send, without a database, to count its bound parameters
const d = drizzle(async () => ({ rows: [] }))

const report = (i: number): ReportIn => ({
  id: `r${i}`,
  ts: 1,
  method: 'espresso',
  roast: 'medium',
  brewer: null,
  dose: 18,
  yield: 36,
  time: 28,
  taste: 'balanced',
  diag: 'balanced',
  recipeVersionId: 'espresso-medium@1',
  lot: 'some-lot',
  grinder: '12',
  notes: 'ok',
  timed: true,
})

describe('rowsPerInsert', () => {
  it('keeps a full batch of reports within the D1 limit', () => {
    const n = rowsPerInsert(reports)
    const rows = toReportRows(Array.from({ length: n }, (_, i) => report(i)), {
      userId: 'u',
      knownVersions: new Set(['espresso-medium@1']),
      imported: true,
      now: 1,
    })
    const { params } = d.insert(reports).values(rows).onConflictDoNothing().toSQL()
    expect(params.length).toBeLessThanOrEqual(D1_MAX_PARAMS)
    expect(n).toBeGreaterThan(0)
  })

  it('keeps a full batch of coffees within the D1 limit', () => {
    const n = rowsPerInsert(coffees)
    const rows = Array.from({ length: n }, (_, i) =>
      toCoffeeRow({ id: `c${i}`, roaster: 'R', origin: 'O', process: 'washed', roast: 'light', name: 'N', archived: false, roastedOn: '2026-10-01', updatedAt: 1 }, 'u', 1),
    )
    const { params } = d.insert(coffees).values(rows).toSQL()
    expect(params.length).toBeLessThanOrEqual(D1_MAX_PARAMS)
  })
})
