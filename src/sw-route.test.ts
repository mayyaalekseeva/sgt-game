import { describe, expect, it } from 'vitest'
import { swRoute } from './sw-route'

const scope = 'https://barista.example/'
const route = (path: string, mode: RequestMode = 'cors', method = 'GET', s = scope) =>
  swRoute(new URL(path, 'https://barista.example'), method, mode, s)

describe('swRoute', () => {
  it('leaves every /api request to the network', () => {
    expect(route('/api/health')).toBe('network')
    expect(route('/api/reports')).toBe('network')
    expect(route('/api')).toBe('network')
    expect(route('/api/reports', 'cors', 'POST')).toBe('network')
  })

  it('leaves the Google sign-in navigations alone', () => {
    expect(route('/api/auth/google', 'navigate')).toBe('network')
    expect(route('/api/auth/google/callback?code=x&state=y', 'navigate')).toBe('network')
    expect(route('/api/auth/logout', 'navigate', 'POST')).toBe('network')
  })

  it('serves the app page network-first, with any hash or query', () => {
    expect(route('/', 'navigate')).toBe('shell')
    expect(route('/index.html', 'navigate')).toBe('shell')
    expect(route('/?utm=x#/recipes', 'navigate')).toBe('shell')
  })

  it('does not answer other navigations with the app page', () => {
    expect(route('/lots/brazil-lobo-guara.webp', 'navigate')).toBe('network')
    expect(route('/nope', 'navigate')).toBe('network')
  })

  it('lets the precache answer same-origin GETs', () => {
    expect(route('/assets/index-abc123.js')).toBe('precache')
    expect(route('/icons/icon-192.png', 'no-cors')).toBe('precache')
  })

  it('leaves other origins and non-GET requests alone', () => {
    expect(route('https://fonts.gstatic.com/s/x.woff2')).toBe('network')
    expect(route('/assets/index-abc123.js', 'cors', 'HEAD')).toBe('network')
  })

  it('works under a subpath scope', () => {
    const sub = 'https://barista.example/game/'
    expect(route('/game/', 'navigate', 'GET', sub)).toBe('shell')
    expect(route('/game/api/health', 'cors', 'GET', sub)).toBe('network')
    expect(route('/game/assets/a.js', 'cors', 'GET', sub)).toBe('precache')
    expect(route('/other/', 'navigate', 'GET', sub)).toBe('network')
  })
})
