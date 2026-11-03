import type { RankId } from './data'
import type { DrillId } from './drills'
import { gainsFor, type Progress } from './progress'

// Moments: a short celebration when the player's own action earns a rank, passes a drill field test or completes
// a mission. Found by comparing derived progress before and after the action, never from stored flags. Each event
// has an id, remembered once celebrated (src/moments-layer.tsx), so a reload or a sync never plays it again.

export type Moment =
  | { kind: 'rank'; id: string; rank: RankId; idx: number } // idx: the new rank's index, so idx + 1 chevrons
  | { kind: 'drill'; id: string; drill: DrillId }
  | { kind: 'mission'; id: string; mission: string; xp: number; from: number } // from: 0..1, the bar before

// How long each one stays on screen unless tapped away
export const MOMENT_MS: Record<Moment['kind'], number> = { rank: 2500, drill: 1800, mission: 2200 }

/** What a single action earned, smallest first so a promotion comes last. */
export function momentsFor(before: Progress, after: Progress): Moment[] {
  const g = gainsFor(before, after)
  const passed = new Set(before.drills.filter((d) => d.quizPassed).map((d) => d.id))
  const drills: Moment[] = after.drills
    .filter((d) => d.quizPassed && !passed.has(d.id))
    .map((d) => ({ kind: 'drill', id: `drill:${d.id}`, drill: d.id }))
  const missions: Moment[] = g.missions.map((id) => {
    const was = before.missions.find((m) => m.id === id)
    const now = after.missions.find((m) => m.id === id)!
    return { kind: 'mission', id: `mission:${id}`, mission: id, xp: now.xp, from: was ? Math.min(1, was.cur / was.goal) : 0 }
  })
  const rank: Moment[] = g.rankUp ? [{ kind: 'rank', id: `rank:${g.rankUp}`, rank: g.rankUp, idx: after.rank.idx }] : []
  return [...drills, ...missions, ...rank]
}

/** The moments not celebrated yet, each once. */
export function fresh(moments: Moment[], celebrated: readonly string[]): Moment[] {
  const seen = new Set(celebrated)
  return moments.filter((m) => !seen.has(m.id) && (seen.add(m.id), true))
}

/** Reads the celebrated event ids from storage; anything else is dropped. */
export function parseCelebrated(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
}

/** Never over a running brew timer, nor on the timer screen: they wait in the queue until both are over. */
export const showMoments = (timing: boolean, onTimerScreen: boolean) => !timing && !onTimerScreen
