import { describe, expect, it } from 'vitest'
import { freshness, forRoast, isMyRef, mergeCoffees, myRef, parseCoffee, parseCoffees, resolvePick, workingKey, coffeeName, type MyCoffee } from './coffees'
import { RECIPES } from './data'
import { currentLots } from './lots'

const ID = 'a'.repeat(32)
const mine = (over: Partial<MyCoffee> = {}): MyCoffee => ({
  id: ID,
  roaster: 'Fábrica',
  origin: 'Ethiopia',
  process: 'natural',
  roast: 'light',
  updatedAt: 1000,
  ...over,
})

describe('parseCoffee', () => {
  it('accepts a full coffee and trims its text', () => {
    expect(parseCoffee({ ...mine(), roaster: '  Fábrica ', name: ' Yirga ' })).toEqual({ ...mine(), name: 'Yirga' })
  })

  it('takes a process of your own words', () => {
    expect(parseCoffee({ ...mine(), process: ' Carbonic maceration ' })?.process).toBe('Carbonic maceration')
  })

  it('drops an empty name and unknown fields', () => {
    expect(parseCoffee({ ...mine(), name: '', extra: 1 })).toEqual(mine())
  })

  it.each<[string, Record<string, unknown>]>([
    ['a short id', { id: 'abc' }],
    ['an empty roaster', { roaster: '  ' }],
    ['no origin', { origin: undefined }],
    ['an empty process', { process: ' ' }],
    ['a long process', { process: 'x'.repeat(31) }],
    ['an unknown roast', { roast: 'blonde' }],
    ['a long name', { name: 'x'.repeat(61) }],
    ['no updatedAt', { updatedAt: undefined }],
    ['a roast date that is not a day', { roastedOn: '20/10/2026' }],
  ])('rejects %s', (_n, over) => {
    expect(parseCoffee({ ...mine(), ...over })).toBeNull()
  })

  it('skips bad entries in a list', () => {
    expect(parseCoffees([mine(), { id: 'bad' }, null])).toEqual([mine()])
    expect(parseCoffees('nope')).toEqual([])
  })
})

describe('mergeCoffees', () => {
  it('keeps the later edit of each coffee', () => {
    const old = mine({ roaster: 'Old', updatedAt: 1 })
    const other = mine({ id: 'b'.repeat(32), updatedAt: 5 })
    const edited = mine({ roaster: 'New', updatedAt: 9 })
    expect(mergeCoffees([old, other], [edited]).map((c) => c.roaster)).toEqual(['Fábrica', 'New'])
    expect(mergeCoffees([edited], [old])[0].roaster).toBe('New')
  })
})

describe('refs and names', () => {
  it('tells your coffees from the roaster lots', () => {
    expect(isMyRef(myRef(ID))).toBe(true)
    expect(isMyRef('peru-naranjo-yacu')).toBe(false)
    expect(isMyRef(null)).toBe(false)
  })

  it('names lots and your coffees, with roaster and origin when there is no name', () => {
    expect(coffeeName('brazil-lobo-guara', [])).toBe('Lobo-Guará')
    expect(coffeeName(myRef(ID), [mine()])).toBe('Fábrica · Ethiopia')
    expect(coffeeName(myRef(ID), [mine({ name: 'Yirga' })])).toBe('Yirga')
    expect(coffeeName(myRef(ID), [])).toBeUndefined()
  })
})

describe('workingKey', () => {
  it('adds the coffee to the recipe slug', () => {
    expect(workingKey({ method: 'filter', brewer: 'v60', lot: 'peru-naranjo-yacu' })).toBe('filter-v60|peru-naranjo-yacu')
    expect(workingKey({ method: 'espresso', roast: 'dark', lot: myRef(ID) })).toBe(`espresso-dark|my:${ID}`)
    // reports from before coffees keep the bare slug
    expect(workingKey({ method: 'espresso', roast: 'dark' })).toBe('espresso-dark')
  })
})

describe('resolvePick', () => {
  const base = { method: 'espresso', roast: 'medium', brewer: 'v60' } as const

  it('takes the roaster lot as it is, and the picker roast for espresso', () => {
    const p = resolvePick({ ...base, lot: 'peru-naranjo-yacu' }, [])
    expect(p).toMatchObject({ lot: 'peru-naranjo-yacu', slug: 'espresso-medium', key: 'espresso-medium|peru-naranjo-yacu' })
    expect(p.mine).toBeUndefined()
  })

  it('takes the roast from your coffee for espresso', () => {
    const p = resolvePick({ ...base, lot: myRef(ID) }, [mine({ roast: 'dark' })])
    expect(p).toMatchObject({ slug: 'espresso-dark', key: `espresso-dark|my:${ID}` })
    expect(p.mine?.id).toBe(ID)
  })

  it('uses the brewer for filter, whatever the coffee', () => {
    expect(resolvePick({ ...base, method: 'filter', lot: myRef(ID) }, [mine()]).slug).toBe('filter-v60')
  })

  it('falls back to the first current lot for no lot, an unknown lot or a coffee that is not here', () => {
    const first = currentLots()[0].slug
    expect(resolvePick({ ...base, lot: null }, []).lot).toBe(first)
    expect(resolvePick({ ...base, lot: 'kenya-gone' }, []).lot).toBe(first)
    expect(resolvePick({ ...base, lot: myRef(ID) }, []).lot).toBe(first)
  })
})

describe('forRoast', () => {
  const v60 = RECIPES['filter-v60'] // 92-96 °C, medium_fine

  it('leaves medium, unknown roasts and espresso alone', () => {
    expect(forRoast(v60, 'medium')).toBe(v60)
    expect(forRoast(v60, undefined)).toBe(v60)
    expect(forRoast(RECIPES['espresso-light'], 'dark')).toBe(RECIPES['espresso-light'])
  })

  it('makes light hotter and finer, dark cooler and coarser', () => {
    expect(forRoast(v60, 'light')).toMatchObject({ temp: [94, 96], grind: 'fine' })
    expect(forRoast(v60, 'dark')).toMatchObject({ temp: [88, 92], grind: 'medium' })
  })

  it('keeps the grind inside the scale', () => {
    const fp = RECIPES['filter-frenchpress'] // coarse
    expect(forRoast(fp, 'dark').grind).toBe('coarse')
  })
})

describe('freshness', () => {
  it('is unknown without a date or for a future one', () => {
    expect(freshness(undefined, '2026-10-27', 'filter')).toBeNull()
    expect(freshness('2026-10-28', '2026-10-27', 'filter')).toBeNull()
  })

  it('counts calendar days', () => {
    expect(freshness('2026-10-27', '2026-10-27', 'filter')?.days).toBe(0)
    expect(freshness('2026-09-27', '2026-10-27', 'filter')?.days).toBe(30)
  })

  it('rests 3 days for filter and 7 for espresso', () => {
    expect(freshness('2026-10-25', '2026-10-27', 'filter')?.stage).toBe('resting')
    expect(freshness('2026-10-24', '2026-10-27', 'filter')?.stage).toBe('peak')
    expect(freshness('2026-10-21', '2026-10-27', 'espresso')?.stage).toBe('resting')
    expect(freshness('2026-10-20', '2026-10-27', 'espresso')?.stage).toBe('peak')
  })

  it('peaks to day 30, fades to day 60, then is stale', () => {
    expect(freshness('2026-09-27', '2026-10-27', 'filter')?.stage).toBe('peak')
    expect(freshness('2026-09-26', '2026-10-27', 'filter')?.stage).toBe('fading')
    expect(freshness('2026-08-28', '2026-10-27', 'filter')?.stage).toBe('fading')
    expect(freshness('2026-08-27', '2026-10-27', 'filter')?.stage).toBe('stale')
  })
})
