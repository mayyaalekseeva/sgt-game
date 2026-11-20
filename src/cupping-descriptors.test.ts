import { describe, expect, it } from 'vitest'
import { SCA_FORM } from './cupping'
import {
  MAX_TAGS,
  SIMPLE_DESCRIPTORS,
  WHEEL_ATTRS,
  chainOf,
  childrenOf,
  cleanDetails,
  cleanTags,
  isKnownTag,
  isTagId,
  kindOf,
  tagLabelKey,
  toggleTag,
  withDetail,
} from './cupping-descriptors'
import { DEEP_FLAVORS, FAMILIES } from './flavors'
import { translate, type Key } from './i18n'

describe('cupping descriptors', () => {
  it('has an en and pt label for every tag it offers', () => {
    const ids = [
      ...WHEEL_ATTRS.flatMap((a) => [...FAMILIES.map((f) => f.id), ...DEEP_FLAVORS].map((id) => [a, id])),
      ...Object.entries(SIMPLE_DESCRIPTORS).flatMap(([a, list]) => list.map((id) => [a, id])),
    ]
    for (const [attr, id] of ids) {
      expect(isTagId(id), id).toBe(true)
      for (const lang of ['en', 'pt'] as const) expect(translate(lang, tagLabelKey(attr, id) as Key), `${lang} ${attr} ${id}`).not.toBe(tagLabelKey(attr, id))
    }
  })

  it('offers a descriptor kind for every scored attribute', () => {
    for (const a of SCA_FORM.attributes) expect(kindOf(a.id), a.id).not.toBe('none')
  })

  it('walks the wheel three tiers deep', () => {
    expect(childrenOf('')).toContain('fruity')
    expect(childrenOf('fruity')).toContain('fruity.berry')
    expect(childrenOf('fruity.berry')).toContain('fruity.berry.blackberry')
    expect(childrenOf('fruity.berry.blackberry')).toEqual([])
    expect(childrenOf('spice.pepper')).toEqual([])
    expect(chainOf('fruity.berry.blackberry')).toEqual(['fruity', 'fruity.berry', 'fruity.berry.blackberry'])
  })

  it('knows its tags per attribute', () => {
    expect(isKnownTag('flavor', 'fruity.berry.blackberry')).toBe(true)
    expect(isKnownTag('acidity', 'bright')).toBe(true)
    expect(isKnownTag('acidity', 'fruity')).toBe(false)
    expect(isKnownTag('flavor', 'bright')).toBe(false)
  })

  it('toggles: a finer tag replaces the ones above it, a coarser one is ignored', () => {
    expect(toggleTag(['sweet', 'fruity'], 'fruity.berry')).toEqual(['sweet', 'fruity.berry'])
    expect(toggleTag(['fruity.berry'], 'fruity.berry.blackberry')).toEqual(['fruity.berry.blackberry'])
    const deep = ['fruity.berry.blackberry']
    expect(toggleTag(deep, 'fruity')).toBe(deep)
    expect(toggleTag(deep, 'fruity.berry.blackberry')).toEqual([])
    expect(toggleTag(['fruity.berry'], 'fruity.citrus')).toEqual(['fruity.berry', 'fruity.citrus'])
  })

  it('stops at the limit, but a replacement still fits', () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `x${'a'.repeat(i + 1)}`)
    expect(toggleTag(full, 'sweet')).toBe(full)
    const withFamily = ['fruity', ...full.slice(1)]
    expect(toggleTag(withFamily, 'fruity.berry')).toHaveLength(MAX_TAGS)
  })

  it('cleans tags and details', () => {
    expect(cleanTags(['sweet', 'sweet', 'a.b.c.d', 'Bad', 3])).toEqual(['sweet'])
    expect(cleanTags('sweet')).toEqual([])
    expect(cleanDetails({ flavor: { tags: ['sweet'], note: ' x ' }, body: { note: ' ' }, Bad: { note: 'y' }, acidity: 'no' })).toEqual({ flavor: { tags: ['sweet'], note: 'x' } })
    expect(cleanDetails(null)).toEqual({})
    expect(cleanDetails([])).toEqual({})
  })

  it('changes one attribute and drops it when emptied', () => {
    const a = withDetail(undefined, 'flavor', { tags: ['sweet'] })
    expect(a).toEqual({ flavor: { tags: ['sweet'] } })
    const b = withDetail(a, 'flavor', { note: 'honey' })
    expect(b).toEqual({ flavor: { tags: ['sweet'], note: 'honey' } })
    expect(withDetail(b, 'flavor', { tags: [], note: undefined })).toEqual({})
    expect(a).toEqual({ flavor: { tags: ['sweet'] } })
  })
})
