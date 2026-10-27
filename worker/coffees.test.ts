import { describe, expect, it } from 'vitest'
import { MAX_COFFEES, parseCoffeeBatch, toCoffeeOut, toCoffeeRow, workingKey } from './coffees'

const NOW = Date.UTC(2026, 9, 27)
const coffee = (over: Record<string, unknown> = {}) => ({
  id: 'a'.repeat(32),
  roaster: 'Fábrica',
  origin: 'Ethiopia',
  process: 'natural',
  roast: 'light',
  updatedAt: NOW - 1000,
  ...over,
})
const parse = (body: unknown) => parseCoffeeBatch(body, NOW)

describe('parseCoffeeBatch', () => {
  it('accepts a coffee and fills name and archived', () => {
    expect(parse({ coffees: [coffee({ roaster: ' Fábrica ' })] })).toEqual({ coffees: [{ ...coffee(), name: null, archived: false, roastedOn: null }] })
    expect(parse({ coffees: [coffee({ roastedOn: '2026-10-20' })] })).toMatchObject({ coffees: [{ roastedOn: '2026-10-20' }] })
    expect(parse({ coffees: [coffee({ name: 'Yirga', archived: true })] })).toMatchObject({ coffees: [{ name: 'Yirga', archived: true }] })
  })

  it('takes a process of your own words', () => {
    expect(parse({ coffees: [coffee({ process: 'Carbonic maceration' })] })).toMatchObject({ coffees: [{ process: 'Carbonic maceration' }] })
  })

  it('checks the batch', () => {
    expect(parse(null)).toHaveProperty('error')
    expect(parse({ coffees: [] })).toHaveProperty('error')
    expect(parse({ coffees: Array.from({ length: MAX_COFFEES + 1 }, () => coffee()) })).toHaveProperty('error')
  })

  it.each([
    ['id', 'short'],
    ['roaster', ''],
    ['origin', 'x'.repeat(61)],
    ['process', ''],
    ['process', 'x'.repeat(31)],
    ['roast', 'blonde'],
    ['name', 42],
    ['archived', 'yes'],
    ['roastedOn', '20/10/2026'],
    ['roastedOn', '2026-13-45'],
    ['updatedAt', 1.5],
    ['updatedAt', NOW + 2 * 24 * 60 * 60 * 1000],
  ])('rejects a bad %s (%s) and names the coffee', (field, value) => {
    const out = parse({ coffees: [coffee(), coffee({ [field]: value })] })
    expect((out as { error: string }).error).toContain('coffees[1]')
  })
})

describe('rows', () => {
  it('round-trips through toCoffeeOut', () => {
    const [c] = (parse({ coffees: [coffee({ name: 'Yirga', roastedOn: '2026-10-20' })] }) as { coffees: Parameters<typeof toCoffeeRow>[0][] }).coffees
    const row = toCoffeeRow(c, 'u1', NOW)
    expect(row).toMatchObject({ userId: 'u1', createdAt: NOW })
    expect(toCoffeeOut({ ...row, name: row.name ?? null, archived: row.archived ?? false, roastedOn: row.roastedOn ?? null })).toEqual({
      ...coffee(),
      name: 'Yirga',
      roastedOn: '2026-10-20',
    })
  })
})

describe('workingKey', () => {
  it('matches the client key', () => {
    expect(workingKey('filter-v60', 'peru-naranjo-yacu')).toBe('filter-v60|peru-naranjo-yacu')
    expect(workingKey('espresso-medium', '')).toBe('espresso-medium')
  })
})
