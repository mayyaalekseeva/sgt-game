import { describe, expect, it } from 'vitest'
import { parseDrillBatch, toDrillsOut } from './drills'

const NOW = Date.UTC(2026, 9, 30)
const parse = (body: unknown) => parseDrillBatch(body, NOW)

describe('parseDrillBatch', () => {
  it('accepts passed drills', () => {
    const drills = [
      { id: 'one-change', passedAt: NOW - 1000 },
      { id: 'extraction', passedAt: NOW },
    ]
    expect(parse({ drills })).toEqual({ drills })
  })

  it('checks the batch', () => {
    expect(parse(null)).toHaveProperty('error')
    expect(parse({ drills: [] })).toHaveProperty('error')
    expect(parse({ drills: 'one-change' })).toHaveProperty('error')
  })

  it('refuses the same drill twice', () => {
    const d = { id: 'ratio', passedAt: NOW }
    expect((parse({ drills: [d, d] }) as { error: string }).error).toContain('drills[1]')
  })

  it.each([
    ['id', 'latte-art'],
    ['id', 3],
    ['passedAt', 'yesterday'],
    ['passedAt', 1.5],
    ['passedAt', Date.UTC(2020, 0, 1)],
    ['passedAt', NOW + 2 * 24 * 60 * 60 * 1000],
  ])('rejects a bad %s (%s) and names the drill', (field, value) => {
    const out = parse({ drills: [{ id: 'one-change', passedAt: NOW }, { id: 'extraction', passedAt: NOW, [field]: value }] })
    expect((out as { error: string }).error).toContain('drills[1]')
  })
})

describe('toDrillsOut', () => {
  it('maps each drill to when it was passed', () => {
    expect(toDrillsOut([{ drillId: 'ratio', passedAt: NOW }])).toEqual({ ratio: NOW })
    expect(toDrillsOut([])).toEqual({})
  })
})
