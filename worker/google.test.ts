import { describe, expect, it } from 'vitest'
import { hashSessionId } from './auth'
import { authUrl, callbackUrl, decodeIdToken, pkceChallenge, profileFromClaims, randomToken } from './google'

const CLIENT = 'client-123.apps.googleusercontent.com'
const NOW = Date.UTC(2026, 9, 27)

const claims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  exp: NOW / 1000 + 3600,
  sub: '1234567890',
  email: 'barista@example.com',
  email_verified: true,
  name: 'Ana Barista',
  picture: 'https://lh3.googleusercontent.com/a/x',
  ...over,
})

// Worker tsconfig has no Node types, so no Buffer
const b64url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (payload: object) => `${b64url('{"alg":"RS256"}')}.${b64url(JSON.stringify(payload))}.sig`

describe('randomToken', () => {
  it('is 32 bytes of base64url and never repeats', () => {
    const a = randomToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(a)
  })
})

describe('hashSessionId', () => {
  it('is the hex SHA-256 of the cookie, not the cookie itself', async () => {
    expect(await hashSessionId('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('pkceChallenge', () => {
  it('matches the RFC 7636 example', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })
})

describe('authUrl', () => {
  it('asks Google for a code with PKCE and the openid scopes', () => {
    const u = new URL(authUrl({ clientId: CLIENT, redirectUri: 'https://x.dev/cb', state: 's1', challenge: 'c1' }))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: CLIENT,
      redirect_uri: 'https://x.dev/cb',
      response_type: 'code',
      scope: 'openid email profile',
      state: 's1',
      code_challenge: 'c1',
      code_challenge_method: 'S256',
    })
  })
})

describe('callbackUrl', () => {
  it('keeps the origin the request came in on', () => {
    expect(callbackUrl('http://localhost:5173/api/auth/google?x=1')).toBe('http://localhost:5173/api/auth/google/callback')
  })
})

describe('decodeIdToken', () => {
  it('reads the payload, including non-ASCII names', () => {
    expect(decodeIdToken(jwt({ sub: '1', name: 'João Grão' }))).toEqual({ sub: '1', name: 'João Grão' })
  })

  it('throws on something that is not a JWT', () => {
    expect(() => decodeIdToken('nope')).toThrow()
  })
})

describe('profileFromClaims', () => {
  it('returns the profile for a valid token', () => {
    expect(profileFromClaims(claims(), CLIENT, NOW)).toEqual({
      sub: '1234567890',
      email: 'barista@example.com',
      name: 'Ana Barista',
      picture: 'https://lh3.googleusercontent.com/a/x',
    })
  })

  it('accepts the bare issuer Google also uses', () => {
    expect(profileFromClaims(claims({ iss: 'accounts.google.com' }), CLIENT, NOW)).not.toBeNull()
  })

  it('allows a missing name and picture', () => {
    expect(profileFromClaims(claims({ name: undefined, picture: undefined }), CLIENT, NOW)).toMatchObject({
      name: null,
      picture: null,
    })
  })

  it.each([
    ['another issuer', { iss: 'https://evil.example' }],
    ['another client', { aud: 'someone-else' }],
    ['an expired token', { exp: NOW / 1000 }],
    ['a missing exp', { exp: undefined }],
    ['a missing sub', { sub: undefined }],
    ['an unverified email', { email_verified: false }],
    ['a string email_verified', { email_verified: 'true' }],
  ])('rejects %s', (_, over) => {
    expect(profileFromClaims(claims(over), CLIENT, NOW)).toBeNull()
  })
})
