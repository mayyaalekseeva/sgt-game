// Google sign-in: OAuth authorization code flow with PKCE.
// Pure helpers: no Hono or D1 here, so they can be tested in Node.

export const OAUTH_COOKIE = 'oauth'
export const OAUTH_TTL_S = 10 * 60

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0))

// 32 random bytes, base64url: the session cookie, OAuth state and PKCE verifier
export const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)))

export const pkceChallenge = async (verifier: string) =>
  b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))

export const callbackUrl = (requestUrl: string) => new URL('/api/auth/google/callback', requestUrl).href

export function authUrl(o: { clientId: string; redirectUri: string; state: string; challenge: string }) {
  const u = new URL(GOOGLE_AUTH_URL)
  u.search = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: o.state,
    code_challenge: o.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return u.href
}

// Returns the raw ID token. It comes straight from Google's token endpoint over TLS, so its
// signature need not be checked (OpenID Connect Core 3.1.3.7); the claims still are.
export async function exchangeCode(o: {
  clientId: string
  clientSecret: string
  redirectUri: string
  code: string
  verifier: string
}): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: o.clientId,
      client_secret: o.clientSecret,
      redirect_uri: o.redirectUri,
      code: o.code,
      code_verifier: o.verifier,
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { id_token?: unknown }
  if (typeof body.id_token !== 'string') throw new Error('Google token response has no id_token')
  return body.id_token
}

export function decodeIdToken(jwt: string): Record<string, unknown> {
  const payload = jwt.split('.')[1]
  if (!payload) throw new Error('Malformed ID token')
  return JSON.parse(new TextDecoder().decode(fromB64url(payload)))
}

export interface GoogleProfile {
  sub: string
  email: string
  name: string | null
  picture: string | null
}

// null when the token is not for us, expired, or the email is unverified
export function profileFromClaims(c: Record<string, unknown>, clientId: string, now: number): GoogleProfile | null {
  if (!GOOGLE_ISSUERS.includes(c.iss as string)) return null
  if (c.aud !== clientId) return null
  if (typeof c.exp !== 'number' || c.exp * 1000 <= now) return null
  if (typeof c.sub !== 'string' || !c.sub) return null
  if (typeof c.email !== 'string' || c.email_verified !== true) return null
  return {
    sub: c.sub,
    email: c.email,
    name: typeof c.name === 'string' ? c.name : null,
    picture: typeof c.picture === 'string' ? c.picture : null,
  }
}
