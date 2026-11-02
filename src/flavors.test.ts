import { describe, expect, it } from 'vitest'
import { FAMILIES, FLAVORS, MAX_FLAVORS, cleanFlavors, familyOf, isFlavorId, sharedFlavors, suggestFlavors, toggleFlavor } from './flavors'
import { translate, type Key } from './i18n'

describe('flavors', () => {
  it('has unique, well-formed ids, each with an en and pt label', () => {
    expect(new Set(FLAVORS).size).toBe(FLAVORS.length)
    for (const id of FLAVORS) {
      expect(isFlavorId(id), id).toBe(true)
      for (const lang of ['en', 'pt'] as const) expect(translate(lang, `flavor.${id}` as Key), `${lang} ${id}`).not.toBe(`flavor.${id}`)
    }
    expect(FLAVORS).toContain('fruity.berry')
    expect(familyOf('fruity.berry')).toBe('fruity')
    expect(familyOf('fruity')).toBe('fruity')
  })

  it('cleans a stored list: well-formed ids once each, at most five, unknown ones kept', () => {
    expect(cleanFlavors(['sweet', 'sweet', 'Bad id', 7, 'new_family.thing'])).toEqual(['sweet', 'new_family.thing'])
    expect(cleanFlavors(FLAVORS)).toHaveLength(MAX_FLAVORS)
    expect(cleanFlavors('sweet')).toEqual([])
    expect(cleanFlavors(undefined)).toEqual([])
  })

  it('toggles a flavor, a specific taking its bare family’s place', () => {
    expect(toggleFlavor(['sweet', 'fruity'], 'fruity.berry')).toEqual(['sweet', 'fruity.berry'])
    expect(toggleFlavor(['fruity.berry'], 'fruity.citrus')).toEqual(['fruity.berry', 'fruity.citrus'])
    expect(toggleFlavor(['fruity.berry'], 'fruity.berry')).toEqual([])
    const full = FAMILIES.slice(0, MAX_FLAVORS).map((f) => f.id)
    expect(toggleFlavor(full, 'off')).toBe(full)
    // replacing does not grow the list, so it works when full
    expect(toggleFlavor(full, 'fruity.berry')).toEqual(['fruity.berry', ...full.slice(1)])
  })

  it('suggests the roaster’s specifics, then your recent ones, once each and never an off-note', () => {
    const recent = [['sweet.caramel', 'off.ashy'], ['fruity.citrus', 'sweet.caramel'], ['floral.tea']]
    expect(suggestFlavors(['fruity', 'fruity.citrus', 'spice.ginger'], recent)).toEqual(['fruity.citrus', 'spice.ginger', 'sweet.caramel', 'floral.tea'])
    expect(suggestFlavors([], [['sweet.caramel', 'unknown.thing']])).toEqual(['sweet.caramel'])
    expect(suggestFlavors(FLAVORS, [], 3)).toHaveLength(3)
  })

  it('shares a flavor with the roaster by id or family, never an off-note', () => {
    expect(sharedFlavors(['fruity.citrus', 'sweet.caramel', 'roasted'], ['sweet.caramel', 'fruity.berry'])).toEqual(['fruity.citrus', 'sweet.caramel'])
    expect(sharedFlavors(['off.papery'], ['off'])).toEqual([])
    expect(sharedFlavors(['sweet'], [])).toEqual([])
  })
})
