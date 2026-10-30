import type { Report } from './data'

// Popular home and café grinders. A report stores the id, so never rename or remove one; add new ones freely.
// Names are brand names and stay the same in every language.
export type GrinderKind = 'hand' | 'electric'

export interface Grinder {
  id: string
  name: string
  kind: GrinderKind
}

export const GRINDERS: Grinder[] = [
  { id: 'comandante-c40', name: 'Comandante C40', kind: 'hand' },
  { id: '1zpresso-jx-pro', name: '1Zpresso JX-Pro', kind: 'hand' },
  { id: '1zpresso-j-max', name: '1Zpresso J-Max', kind: 'hand' },
  { id: '1zpresso-k-ultra', name: '1Zpresso K-Ultra', kind: 'hand' },
  { id: '1zpresso-q2', name: '1Zpresso Q2', kind: 'hand' },
  { id: 'timemore-c2', name: 'Timemore Chestnut C2', kind: 'hand' },
  { id: 'timemore-c3', name: 'Timemore Chestnut C3', kind: 'hand' },
  { id: 'kingrinder-k6', name: 'Kingrinder K6', kind: 'hand' },
  { id: 'hario-skerton', name: 'Hario Skerton', kind: 'hand' },
  { id: 'niche-zero', name: 'Niche Zero', kind: 'electric' },
  { id: 'df64', name: 'DF64', kind: 'electric' },
  { id: 'eureka-mignon-specialita', name: 'Eureka Mignon Specialità', kind: 'electric' },
  { id: 'baratza-encore', name: 'Baratza Encore', kind: 'electric' },
  { id: 'baratza-encore-esp', name: 'Baratza Encore ESP', kind: 'electric' },
  { id: 'baratza-sette-270', name: 'Baratza Sette 270', kind: 'electric' },
  { id: 'fellow-ode-2', name: 'Fellow Ode Gen 2', kind: 'electric' },
  { id: 'fellow-opus', name: 'Fellow Opus', kind: 'electric' },
  { id: 'sage-smart-grinder-pro', name: 'Sage / Breville Smart Grinder Pro', kind: 'electric' },
  { id: 'timemore-sculptor-064', name: 'Timemore Sculptor 064', kind: 'electric' },
  { id: 'wilfa-uniform', name: 'Wilfa Uniform', kind: 'electric' },
  { id: 'mazzer-mini', name: 'Mazzer Mini', kind: 'electric' },
  { id: 'mahlkonig-e65s', name: 'Mahlkönig E65S', kind: 'electric' },
  { id: 'mahlkonig-ek43', name: 'Mahlkönig EK43', kind: 'electric' },
]

export const GRINDER_KINDS: GrinderKind[] = ['hand', 'electric']

// Same as the server (worker/reports.ts GRINDER_MODEL). An id this build does not list is kept: a newer build added it.
export const isGrinderModel = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)

/** The grinder's name, or its id when this build does not know it. */
export const grinderName = (id: string) => GRINDERS.find((g) => g.id === id)?.name ?? id

/** "Comandante C40 · 18 clicks", either part alone, or '' when the report names neither. */
export const grinderText = (r: Pick<Report, 'grinder' | 'grinderModel'>) =>
  [r.grinderModel && grinderName(r.grinderModel), r.grinder].filter(Boolean).join(' · ')

/** The grinder of the newest report that names one: most players own one grinder, so it is the default. */
export const lastGrinderModel = (reports: Report[]) => reports.reduce<Report | undefined>((a, r) => (r.grinderModel && (!a || r.ts > a.ts) ? r : a), undefined)?.grinderModel
