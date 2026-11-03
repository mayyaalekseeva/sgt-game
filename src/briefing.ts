// The first-run briefing and the player's level. Both stay on this device (the store's localStorage),
// for guests and signed-in players alike. The level only changes the Sargento's greeting and which
// missions and Profile rows are listed first: it never hides or locks anything, and never touches XP.

export type Level = 'recruit' | 'home' | 'pro'
export const LEVELS: Level[] = ['recruit', 'home', 'pro']

export interface Briefing {
  seen: boolean // shown once; skipping counts as seen
  level: Level | null // null until answered
}

export const parseLevel = (v: unknown): Level | null => (LEVELS.includes(v as Level) ? (v as Level) : null)

/** What the store saved, or anything else: a missing or broken value means not seen, no level */
export function parseBriefing(raw: unknown): Briefing {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { seen: o.seen === true, level: parseLevel(o.level) }
}

/** First run: show the briefing until it has been finished or skipped once */
export const needsBriefing = (b: Briefing) => !b.seen

// Missions listed first for each level; the rest keep their order from MISSIONS (src/data.ts)
const FIRST: Record<Level, string[]> = {
  recruit: ['m1', 'm2', 'm8', 'm5', 'm6'],
  home: ['m5', 'm10', 'm8', 'm2', 'm11'],
  pro: ['m11', 'm10', 'm7', 'm4', 'm3'],
}

export function missionsFor<M extends { id: string }>(missions: M[], level: Level | null): M[] {
  if (!level) return missions
  const rank = (m: M) => {
    const i = FIRST[level].indexOf(m.id)
    return i < 0 ? FIRST[level].length : i
  }
  // sort is stable, so missions outside the list keep their order
  return [...missions].sort((a, b) => rank(a) - rank(b))
}

// Profile rows listed first for each level; the rest keep their order. Every row is always shown.
const PROFILE_FIRST: Partial<Record<Level, string[]>> = { pro: ['cupping'] }

export function profileRowsFor<R extends { id: string }>(rows: R[], level: Level | null): R[] {
  const first = (level && PROFILE_FIRST[level]) || []
  const rank = (r: R) => {
    const i = first.indexOf(r.id)
    return i < 0 ? first.length : i
  }
  return [...rows].sort((a, b) => rank(a) - rank(b))
}

// The same for grouped rows: rows sort inside their group, and the group whose first row was promoted moves up
export function profileGroupsFor<R extends { id: string }, G extends { id: string; rows: R[] }>(groups: G[], level: Level | null): G[] {
  const sorted = groups.map((g) => ({ ...g, rows: profileRowsFor(g.rows, level) }))
  const lead = sorted.map((g) => ({ id: g.rows[0]?.id ?? g.id, g }))
  return profileRowsFor(lead, level).map((l) => l.g)
}
