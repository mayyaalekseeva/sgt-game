import { describe, expect, it } from 'vitest'
import { HOME, SUBS, TABS, parseRoute, routeHash } from './route'

describe('parseRoute', () => {
  it.each(['', '#', '#/', '#signin-failed', '#/nope', '#/orders/diary/extra', '#/Orders'])('%j opens the home screen', (hash) => {
    expect(parseRoute(hash)).toEqual(HOME)
  })

  it('reads a tab, with or without a trailing slash', () => {
    expect(parseRoute('#/profile')).toEqual({ tab: 'profile', sub: null })
    expect(parseRoute('#/profile/')).toEqual({ tab: 'profile', sub: null })
  })

  it('reads a sub-screen over the tab it was opened from', () => {
    expect(parseRoute('#/profile/diary')).toEqual({ tab: 'profile', sub: 'diary' })
    expect(parseRoute('#/diag/diary')).toEqual({ tab: 'diag', sub: 'diary' })
    expect(parseRoute('#/profile/feed')).toEqual({ tab: 'profile', sub: 'feed' })
  })

  it('keeps the tab when the sub-screen is unknown', () => {
    expect(parseRoute('#/profile/settings')).toEqual({ tab: 'profile', sub: null })
  })
})

describe('routeHash', () => {
  it('round-trips every tab and sub-screen', () => {
    for (const tab of TABS) {
      expect(parseRoute(routeHash({ tab, sub: null }))).toEqual({ tab, sub: null })
      for (const sub of SUBS) expect(parseRoute(routeHash({ tab, sub }))).toEqual({ tab, sub })
    }
  })

  it('writes #/tab and #/tab/sub', () => {
    expect(routeHash({ tab: 'recipes', sub: null })).toBe('#/recipes')
    expect(routeHash({ tab: 'profile', sub: 'saved' })).toBe('#/profile/saved')
  })
})
