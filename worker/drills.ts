import { DRILL_IDS } from './db/schema'

// A passed drill field test as the client sends it (src/drills.ts Passed, one entry per drill)
export interface DrillPassIn {
  id: (typeof DRILL_IDS)[number]
  passedAt: number
}

const EARLIEST_TS = Date.UTC(2024, 0, 1)
const DAY = 24 * 60 * 60 * 1000

/** Validates a POST /api/drills body: { drills: [{ id, passedAt }] }. */
export function parseDrillBatch(body: unknown, now = Date.now()): { drills: DrillPassIn[] } | { error: string } {
  const list = (body as { drills?: unknown } | null)?.drills
  if (!Array.isArray(list)) return { error: 'expected { drills: [...] }' }
  if (list.length === 0 || list.length > DRILL_IDS.length) return { error: `send 1 to ${DRILL_IDS.length} drills` }
  const out: DrillPassIn[] = []
  for (const [i, d] of (list as Record<string, unknown>[]).entries()) {
    const at = `drills[${i}]`
    if (typeof d !== 'object' || d === null) return { error: `${at}: expected an object` }
    if (!DRILL_IDS.includes(d.id as DrillPassIn['id'])) return { error: `${at}.id is not a drill` }
    if (out.some((x) => x.id === d.id)) return { error: `${at}.id appears twice` }
    if (!Number.isInteger(d.passedAt) || (d.passedAt as number) < EARLIEST_TS || (d.passedAt as number) > now + DAY) {
      return { error: `${at}.passedAt is out of range` }
    }
    out.push({ id: d.id as DrillPassIn['id'], passedAt: d.passedAt as number })
  }
  return { drills: out }
}

/** GET /api/reports: passedAt per drill, the shape the client keeps. */
export const toDrillsOut = (rows: { drillId: string; passedAt: number }[]) =>
  Object.fromEntries(rows.map((r) => [r.drillId, r.passedAt]))
