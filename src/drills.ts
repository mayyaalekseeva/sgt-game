import { workingKey } from './coffees'
import { RECIPES, type Report, type Taste } from './data'
import { diagnose, type DiagId } from './diagnose'

// Drills: short lessons from the Sargento. A briefing (cards), a field test (questions) and, for most, a field
// assignment checked against the player's reports. Passing a field test is the one thing stored (passedAt per
// drill, synced like reports); the assignment, like missions, is derived from reports.

// Same list as the server's DRILL_IDS (worker/db/schema.ts)
export const DRILL_IDS = ['one-change', 'extraction', 'grind-time', 'ratio', 'channeling'] as const
export type DrillId = (typeof DRILL_IDS)[number]
export const isDrillId = (v: unknown): v is DrillId => DRILL_IDS.includes(v as DrillId)

export type ArtId = 'extraction' | 'grind' | 'ratio' | 'puck'

// shot: a shot against an espresso recipe; the right change is whatever diagnose() says, so the field test can
// never disagree with the Diagnosis tab. Options are the d.<id>.change strings. pick: for what the diagnosis does
// not model; strings drill.q.<id>.q, .o0… and .why, with `answer` the index of the right option.
export type Question =
  | { kind: 'shot'; id: string; slug: string; time: number; taste: Taste; yield?: number; distractors: DiagId[] }
  | { kind: 'pick'; id: string; options: number; answer: number }

export interface Assignment {
  xp: number
  goal: number
  progress: (reports: Report[]) => number
}

export interface DrillDef {
  id: DrillId
  art: (ArtId | null)[] // one per briefing card: drill.<id>.c<N>.t / .b
  quiz: Question[]
  assignment?: Assignment // drill.<id>.task
}

export const QUIZ_XP = 30

// passedAt (epoch ms) per drill whose field test was passed
export type Passed = Partial<Record<DrillId, number>>

const espresso = (r: Report[]) => r.filter((x) => x.method === 'espresso')

// Reports grouped by recipe and coffee, oldest first
function byCoffee(reports: Report[]) {
  const groups = new Map<string, Report[]>()
  for (const r of [...reports].sort((a, b) => a.ts - b.ts)) {
    const k = workingKey(r)
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  return [...groups.values()]
}

const ratioOf = (r: { dose: number; yield: number }) => r.yield / r.dose

export const DRILLS: DrillDef[] = [
  {
    id: 'one-change',
    art: [null, null, null],
    quiz: [
      { kind: 'pick', id: 'oc1', options: 3, answer: 1 },
      { kind: 'pick', id: 'oc2', options: 3, answer: 2 },
    ],
    // three brews of the same coffee on the same recipe
    assignment: { xp: 50, goal: 3, progress: (r) => Math.max(0, ...byCoffee(r).map((g) => g.length)) },
  },
  {
    id: 'extraction',
    art: ['extraction', null, null],
    quiz: [
      { kind: 'pick', id: 'ex1', options: 3, answer: 0 },
      { kind: 'shot', id: 'ex2', slug: 'espresso-medium', time: 27, taste: 'sour', distractors: ['bitter_ok', 'thin_ok'] },
      { kind: 'shot', id: 'ex3', slug: 'espresso-medium', time: 27, taste: 'bitter', distractors: ['sour_ok', 'bitter_fast'] },
    ],
    // a sour or bitter cup, then a balanced one of the same coffee
    assignment: {
      xp: 50,
      goal: 1,
      progress: (r) =>
        byCoffee(r).some((g) => {
          const off = g.findIndex((x) => x.taste === 'sour' || x.taste === 'bitter')
          return off >= 0 && g.slice(off + 1).some((x) => x.taste === 'balanced')
        })
          ? 1
          : 0,
    },
  },
  {
    id: 'grind-time',
    art: ['grind', null, null],
    quiz: [
      { kind: 'shot', id: 'gt1', slug: 'espresso-medium', time: 19, taste: 'sour', distractors: ['bitter_slow', 'sour_ok'] },
      { kind: 'shot', id: 'gt2', slug: 'espresso-medium', time: 38, taste: 'bitter', distractors: ['sour_fast', 'bitter_ok'] },
      { kind: 'shot', id: 'gt3', slug: 'espresso-medium', time: 18, taste: 'thin', distractors: ['thin_ok', 'bitter_slow'] },
    ],
    // an espresso on target: balanced and in the recipe's time
    assignment: { xp: 50, goal: 1, progress: (r) => espresso(r).filter((x) => x.diag === 'balanced').length },
  },
  {
    id: 'ratio',
    art: ['ratio', null, null],
    quiz: [
      { kind: 'pick', id: 'ra1', options: 3, answer: 2 },
      { kind: 'shot', id: 'ra2', slug: 'espresso-medium', time: 28, taste: 'thin', yield: 46, distractors: ['thin_ok', 'sour_ok'] },
      { kind: 'shot', id: 'ra3', slug: 'espresso-medium', time: 28, taste: 'thin', distractors: ['thin_yield', 'bitter_ok'] },
    ],
    // two espressos of the same coffee, ratios at least 0.5 apart (1:2 and 1:2.5)
    assignment: {
      xp: 50,
      goal: 2,
      progress: (r) => {
        const groups = byCoffee(espresso(r))
        if (groups.length === 0) return 0
        const spread = groups.some((g) => {
          const rs = g.map(ratioOf)
          return Math.max(...rs) - Math.min(...rs) >= 0.5
        })
        return spread ? 2 : 1
      },
    },
  },
  {
    id: 'channeling',
    art: ['puck', null, null, null],
    quiz: [
      { kind: 'pick', id: 'ch1', options: 3, answer: 1 },
      { kind: 'pick', id: 'ch2', options: 3, answer: 0 },
      { kind: 'shot', id: 'ch3', slug: 'espresso-medium', time: 34, taste: 'sour', distractors: ['sour_fast', 'bitter_slow'] },
    ],
  },
]

export const drillById = (id: string) => DRILLS.find((d) => d.id === id)

/** The right answer to a shot question, from the same diagnosis the Diagnosis tab uses. */
export function shotAnswer(q: Extract<Question, { kind: 'shot' }>): DiagId {
  const r = RECIPES[q.slug]
  return diagnose(r, { dose: r.dose, yield: q.yield ?? r.yield, time: q.time, taste: q.taste })
}

/** A shot question's options: the right change and the distractors, in a fixed order per question. */
export function shotOptions(q: Extract<Question, { kind: 'shot' }>): DiagId[] {
  const all = [shotAnswer(q), ...q.distractors]
  // rotate by the question id, so the right one is not always first
  const n = [...q.id].reduce((a, c) => a + c.charCodeAt(0), 0) % all.length
  return [...all.slice(n), ...all.slice(0, n)]
}

/**
 * Each drill's state. A drill opens once the previous field test is passed. Its assignment counts only once it is
 * open, so XP never appears for a drill the player has not reached.
 */
export function drillProgress(reports: Report[], passed: Passed) {
  const drills = DRILLS.map((d, i) => {
    const unlocked = i === 0 || passed[DRILLS[i - 1].id] !== undefined
    const quizPassed = unlocked && passed[d.id] !== undefined
    const a = d.assignment
    const cur = a && unlocked ? Math.min(a.goal, a.progress(reports)) : 0
    const assignment = a ? { xp: a.xp, goal: a.goal, cur, done: unlocked && cur >= a.goal } : null
    return { id: d.id, unlocked, quizPassed, assignment, done: quizPassed && (assignment?.done ?? true) }
  })
  const xp = drills.reduce((n, d) => n + (d.quizPassed ? QUIZ_XP : 0) + (d.assignment?.done ? d.assignment.xp : 0), 0)
  return { xp, drills }
}

/** Reads passed drills from storage or the API; unknown ids and bad times are dropped. */
export function parsePassed(raw: unknown): Passed {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).filter(([id, at]) => isDrillId(id) && typeof at === 'number' && Number.isInteger(at) && at > 0),
  )
}
