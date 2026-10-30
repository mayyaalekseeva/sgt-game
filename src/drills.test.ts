import { describe, expect, it } from 'vitest'
import { DRILL_IDS as SERVER_DRILL_IDS } from '../worker/db/schema'
import type { Report } from './data'
import { DRILLS, DRILL_IDS, QUIZ_XP, drillProgress, parsePassed, shotAnswer, shotOptions, type DrillId, type Question } from './drills'
import { translate, type Key } from './i18n'
import { gainsFor, progressFor } from './progress'

const T0 = Date.UTC(2026, 9, 30, 9, 0)
let n = 0
const report = (over: Partial<Report> = {}): Report => ({
  id: `r${++n}`,
  ts: T0 + n,
  method: 'espresso',
  roast: 'medium',
  dose: 18,
  yield: 36,
  time: 27,
  taste: 'balanced',
  diag: 'balanced',
  lot: 'peru-naranjo-yacu',
  ...over,
})

const shots = DRILLS.flatMap((d) => d.quiz.filter((q): q is Extract<Question, { kind: 'shot' }> => q.kind === 'shot'))
const picks = DRILLS.flatMap((d) => d.quiz.filter((q): q is Extract<Question, { kind: 'pick' }> => q.kind === 'pick'))
const passedUpTo = (id: DrillId) => Object.fromEntries(DRILL_IDS.slice(0, DRILL_IDS.indexOf(id) + 1).map((x) => [x, T0]))
const task = (id: DrillId, reports: Report[]) => drillProgress(reports, passedUpTo(id)).drills.find((d) => d.id === id)!.assignment!

describe('drill content', () => {
  it('lists every drill once, in the same order as the server', () => {
    expect(DRILLS.map((d) => d.id)).toEqual([...DRILL_IDS])
    expect([...SERVER_DRILL_IDS]).toEqual([...DRILL_IDS])
  })

  it('has unique question ids and at least one card and question per drill', () => {
    const ids = DRILLS.flatMap((d) => d.quiz.map((q) => q.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of DRILLS) {
      expect(d.art.length).toBeGreaterThan(0)
      expect(d.quiz.length).toBeGreaterThan(0)
    }
  })

  it.each(shots.map((q) => [q.id, q] as const))('%s: the diagnosis picks one of its options, and the options read differently', (_id, q) => {
    const options = shotOptions(q)
    expect(options).toContain(shotAnswer(q))
    expect(q.distractors).not.toContain(shotAnswer(q))
    for (const lang of ['en', 'pt'] as const) {
      const texts = options.map((o) => translate(lang, `d.${o}.change` as Key))
      expect(new Set(texts).size).toBe(options.length)
    }
  })

  it('does not always put the right change first', () => {
    expect(shots.some((q) => shotOptions(q)[0] !== shotAnswer(q))).toBe(true)
  })

  it.each(picks.map((q) => [q.id, q] as const))('%s: the answer is one of its options', (_id, q) => {
    expect(q.answer).toBeGreaterThanOrEqual(0)
    expect(q.answer).toBeLessThan(q.options)
  })

  it('has every string in both languages', () => {
    const keys: string[] = ['drills.title', 'drills.sub']
    for (const d of DRILLS) {
      keys.push(`drill.${d.id}.t`, `drill.${d.id}.sub`)
      d.art.forEach((_, i) => keys.push(`drill.${d.id}.c${i}.t`, `drill.${d.id}.c${i}.b`))
      if (d.assignment) keys.push(`drill.${d.id}.task`)
    }
    for (const q of picks) {
      keys.push(`drill.q.${q.id}.q`, `drill.q.${q.id}.why`)
      for (let i = 0; i < q.options; i++) keys.push(`drill.q.${q.id}.o${i}`)
    }
    for (const lang of ['en', 'pt'] as const) for (const k of keys) expect(translate(lang, k as Key), `${lang} ${k}`).not.toBe(k)
  })
})

describe('drillProgress', () => {
  it('opens only the first drill at the start', () => {
    const { xp, drills } = drillProgress([], {})
    expect(xp).toBe(0)
    expect(drills.map((d) => d.unlocked)).toEqual([true, false, false, false, false])
  })

  it('opens each drill once the previous field test is passed', () => {
    const { drills } = drillProgress([], { 'one-change': T0, extraction: T0 })
    expect(drills.map((d) => d.unlocked)).toEqual([true, true, true, false, false])
    expect(drills.map((d) => d.quizPassed)).toEqual([true, true, false, false, false])
  })

  it('ignores a pass for a drill that is not open', () => {
    const { xp, drills } = drillProgress([], { ratio: T0 })
    expect(drills.find((d) => d.id === 'ratio')!.quizPassed).toBe(false)
    expect(xp).toBe(0)
  })

  it('counts an assignment only once its drill is open', () => {
    const rs = [report({ taste: 'sour', diag: 'sour_ok' }), report()]
    expect(drillProgress(rs, {}).drills.find((d) => d.id === 'extraction')!.assignment).toMatchObject({ cur: 0, done: false })
    expect(task('extraction', rs)).toMatchObject({ cur: 1, done: true })
  })

  it('adds quiz XP and assignment XP', () => {
    const rs = [report(), report(), report()]
    const { xp } = drillProgress(rs, { 'one-change': T0 })
    expect(xp).toBe(QUIZ_XP + DRILLS[0].assignment!.xp)
  })

  it('calls a drill without an assignment done when its field test is passed', () => {
    const d = drillProgress([], passedUpTo('channeling')).drills.find((x) => x.id === 'channeling')!
    expect(d.assignment).toBeNull()
    expect(d.done).toBe(true)
  })
})

describe('field assignments', () => {
  it('one-change: three brews of the same coffee on the same recipe', () => {
    expect(task('one-change', [report(), report(), report({ lot: 'other' })]).cur).toBe(2)
    expect(task('one-change', [report(), report({ roast: 'dark' }), report()]).cur).toBe(2)
    expect(task('one-change', [report(), report(), report()]).done).toBe(true)
  })

  it('extraction: an off cup, then a balanced one of the same coffee', () => {
    expect(task('extraction', [report(), report({ taste: 'bitter', diag: 'bitter_ok' })]).cur).toBe(0)
    expect(task('extraction', [report({ taste: 'bitter', diag: 'bitter_ok' }), report({ lot: 'other' })]).cur).toBe(0)
    expect(task('extraction', [report({ taste: 'thin', diag: 'thin_ok' }), report()]).cur).toBe(0)
    expect(task('extraction', [report({ taste: 'bitter', diag: 'bitter_ok' }), report()]).cur).toBe(1)
  })

  it('extraction: goes by time, not by the order of the list', () => {
    const rs = [report({ taste: 'sour', diag: 'sour_ok' }), report()]
    expect(task('extraction', [...rs].reverse()).cur).toBe(1)
  })

  it('grind-time: an espresso on target, not a balanced cup with odd numbers', () => {
    expect(task('grind-time', [report({ diag: 'balanced_off' })]).cur).toBe(0)
    expect(task('grind-time', [report({ method: 'filter', roast: undefined, brewer: 'v60' })]).cur).toBe(0)
    expect(task('grind-time', [report()]).cur).toBe(1)
  })

  it('ratio: two espressos of one coffee, ratios at least 0.5 apart', () => {
    expect(task('ratio', []).cur).toBe(0)
    expect(task('ratio', [report(), report({ yield: 40 })]).cur).toBe(1)
    expect(task('ratio', [report(), report({ yield: 45, lot: 'other' })]).cur).toBe(1)
    expect(task('ratio', [report(), report({ yield: 45 })]).cur).toBe(2)
  })
})

describe('progress with drills', () => {
  it('adds drill XP to the total and the rank', () => {
    const without = progressFor([], {})
    const withPass = progressFor([], {}, { 'one-change': T0 })
    expect(withPass.xp - without.xp).toBe(QUIZ_XP)
    expect(withPass.drills[0].quizPassed).toBe(true)
  })

  it('lists the drill assignments a report finishes', () => {
    const passed = { 'one-change': T0, extraction: T0 }
    const sour = report({ taste: 'sour', diag: 'sour_ok' })
    const before = progressFor([sour], {}, passed)
    const after = progressFor([sour, report()], {}, passed)
    expect(gainsFor(before, after).tasks).toEqual(['extraction', 'grind-time'])
  })
})

describe('parsePassed', () => {
  it('keeps known drills with a time', () => {
    expect(parsePassed({ extraction: T0, nope: T0, ratio: 'x', channeling: -1, 'one-change': 1.5 })).toEqual({ extraction: T0 })
  })

  it.each([null, undefined, 'x', 3, [T0]])('reads %j as nothing passed', (raw) => {
    expect(parsePassed(raw)).toEqual({})
  })
})
