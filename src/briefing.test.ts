import { describe, expect, it } from 'vitest'
import { LEVELS, missionsFor, needsBriefing, parseBriefing, parseLevel, profileRowsFor } from './briefing'
import { MISSIONS } from './data'

describe('parseLevel', () => {
  it('keeps the three levels', () => {
    for (const l of LEVELS) expect(parseLevel(l)).toBe(l)
  })

  it('drops anything else', () => {
    for (const v of [undefined, null, '', 'Recruit', 'barista', 1, {}, ['pro']]) expect(parseLevel(v)).toBeNull()
  })
})

describe('parseBriefing', () => {
  it('reads a saved briefing', () => {
    expect(parseBriefing({ seen: true, level: 'home' })).toEqual({ seen: true, level: 'home' })
    expect(parseBriefing({ seen: true, level: null })).toEqual({ seen: true, level: null })
  })

  it('treats a store from before the briefing as not seen', () => {
    expect(parseBriefing(undefined)).toEqual({ seen: false, level: null })
  })

  it('only counts seen when it is exactly true', () => {
    for (const seen of ['true', 1, 'yes', null]) expect(parseBriefing({ seen }).seen).toBe(false)
  })

  it('keeps the flag when the level is broken', () => {
    expect(parseBriefing({ seen: true, level: 'expert' })).toEqual({ seen: true, level: null })
  })

  it('survives values that are not objects', () => {
    for (const raw of [null, 'seen', 42, true]) expect(parseBriefing(raw)).toEqual({ seen: false, level: null })
  })
})

describe('needsBriefing', () => {
  it('shows on first run only', () => {
    expect(needsBriefing({ seen: false, level: null })).toBe(true)
    expect(needsBriefing({ seen: true, level: null })).toBe(false)
    expect(needsBriefing({ seen: true, level: 'pro' })).toBe(false)
  })

  it('shows to a player whose storage was empty or unreadable', () => {
    expect(needsBriefing(parseBriefing(undefined))).toBe(true)
  })
})

describe('missionsFor', () => {
  const ids = (l: Parameters<typeof missionsFor>[1]) => missionsFor(MISSIONS, l).map((m) => m.id)

  it('keeps the usual order without a level', () => {
    expect(ids(null)).toEqual(MISSIONS.map((m) => m.id))
  })

  it('lists every mission once, whatever the level', () => {
    for (const l of LEVELS) expect([...ids(l)].sort()).toEqual(MISSIONS.map((m) => m.id).sort())
  })

  it('puts each level’s missions first', () => {
    expect(ids('recruit')[0]).toBe('m1')
    expect(ids('home')[0]).toBe('m5')
    expect(ids('pro')[0]).toBe('m11')
  })

  it('keeps the rest in their usual order', () => {
    const rest = ids('pro').filter((id) => !['m11', 'm10', 'm7', 'm4', 'm3'].includes(id))
    expect(rest).toEqual(MISSIONS.map((m) => m.id).filter((id) => rest.includes(id)))
  })

  it('does not change the missions themselves', () => {
    const missions = [{ id: 'm6', done: true }, { id: 'm5', done: false }]
    const out = missionsFor(missions, 'home')
    expect(out).toEqual([{ id: 'm5', done: false }, { id: 'm6', done: true }])
    expect(missions[0].id).toBe('m6')
  })
})

describe('profileRowsFor', () => {
  const rows = ['lots', 'coffees', 'diary', 'cupping', 'missions'].map((id) => ({ id }))
  const ids = (l: Parameters<typeof profileRowsFor>[1]) => profileRowsFor(rows, l).map((r) => r.id)

  it('lists cupping first for a pro, and keeps every row for every level', () => {
    expect(ids('pro')).toEqual(['cupping', 'lots', 'coffees', 'diary', 'missions'])
    for (const l of [...LEVELS, null]) expect(ids(l).sort()).toEqual(rows.map((r) => r.id).sort())
  })

  it('keeps the order for the other levels', () => {
    expect(ids('recruit')).toEqual(rows.map((r) => r.id))
    expect(ids('home')).toEqual(rows.map((r) => r.id))
    expect(ids(null)).toEqual(rows.map((r) => r.id))
  })
})
