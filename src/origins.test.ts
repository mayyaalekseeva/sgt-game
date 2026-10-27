import { describe, expect, it } from 'vitest'
import { ORIGINS, fold, searchOrigins } from './origins'

describe('origins', () => {
  it('has unique names in each language', () => {
    for (const lang of ['en', 'pt'] as const) {
      const names = ORIGINS.map((o) => o[lang])
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('folds case and accents', () => {
    expect(fold(' Etiópia ')).toBe('etiopia')
    expect(fold('São Tomé')).toBe('sao tome')
  })

  it('lists everything, sorted, for an empty query', () => {
    const all = searchOrigins('', 'en')
    expect(all).toHaveLength(ORIGINS.length)
    expect(all.slice(0, 2)).toEqual(['Angola', 'Australia'])
  })

  it('finds by any part, starts first, in the chosen language', () => {
    expect(searchOrigins('etio', 'pt')).toEqual(['Etiópia'])
    expect(searchOrigins('ken', 'en')).toEqual(['Kenya'])
    expect(searchOrigins('gu', 'en')).toEqual(['Guatemala', 'Nicaragua', 'Papua New Guinea'])
    expect(searchOrigins('zz', 'en')).toEqual([])
  })
})
