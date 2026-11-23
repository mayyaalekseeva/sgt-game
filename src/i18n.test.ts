import { describe, expect, it } from 'vitest'
import { plural, translate } from './i18n'

describe('plural', () => {
  it('picks the .one key for exactly one, in English and Portuguese', () => {
    expect(translate('en', plural('cupping.fewerCupsShort', 1), { n: 1 })).toBe('1 cup')
    expect(translate('pt', plural('cupping.fewerCupsShort', 1), { n: 1 })).toBe('1 chávena')
    expect(translate('en', plural('cupping.fewerCups', 1), { n: 1 })).toMatch(/^Scored on 1 cup\./)
    expect(translate('pt', plural('cupping.fewerCups', 1), { n: 1 })).toMatch(/^Pontuado em 1 chávena\./)
  })

  it('keeps the plural key for other counts', () => {
    expect(translate('en', plural('cupping.fewerCupsShort', 3), { n: 3 })).toBe('3 cups')
    expect(translate('pt', plural('cupping.fewerCupsShort', 0), { n: 0 })).toBe('0 chávenas')
  })

  it('falls back to the given key when it has no .one form', () => {
    expect(plural('cupping.count', 1)).toBe('cupping.count')
  })
})
