import { findMine, type MyCoffee } from './coffees'
import { missionProgress, rankFor, type Report } from './data'
import { drillProgress, type Passed } from './drills'
import { lotBySlug } from './lots'
import { originOf } from './origins'

// XP, rank, mission and drill progress are always derived from reports and passed drills, never stored as totals.
// Kept out of data.ts, which the recipe seed script loads in plain Node.
// A brew of your own coffee counts for its origin only while the coffee is known here (archived ones are).
export function progressFor(reports: Report[], working: Record<string, string>, passed: Passed = {}, coffees: MyCoffee[] = []) {
  const m = missionProgress(reports, working, (lot) => originOf(findMine(coffees, lot)?.origin ?? lotBySlug(lot)?.country.en))
  const d = drillProgress(reports, passed)
  const xp = m.xp + d.xp
  return { xp, rank: rankFor(xp), missions: m.missions, drills: d.drills }
}

export type Progress = ReturnType<typeof progressFor>

/**
 * What changed between two progress snapshots: XP gained, a new rank, missions and drill assignments newly done
 * (the debrief shows them).
 */
export function gainsFor(before: Progress, after: Progress) {
  const was = new Set(before.missions.filter((m) => m.done).map((m) => m.id))
  const tasks = new Set(before.drills.filter((d) => d.assignment?.done).map((d) => d.id))
  return {
    xp: after.xp - before.xp,
    rankUp: after.rank.idx > before.rank.idx ? after.rank.cur.id : null,
    missions: after.missions.filter((m) => m.done && !was.has(m.id)).map((m) => m.id),
    tasks: after.drills.filter((d) => d.assignment?.done && !tasks.has(d.id)).map((d) => d.id),
  }
}
