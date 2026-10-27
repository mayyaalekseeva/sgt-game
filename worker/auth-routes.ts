import { and, eq, gt, lt, or } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { CookieOptions } from 'hono/utils/cookie'
import { SESSION_COOKIE, SESSION_TTL_MS, hashSessionId } from './auth'
import { db } from './db/client'
import { sessions, users } from './db/schema'
import {
  OAUTH_COOKIE,
  OAUTH_TTL_S,
  authUrl,
  callbackUrl,
  decodeIdToken,
  exchangeCode,
  pkceChallenge,
  profileFromClaims,
  randomToken,
} from './google'

type C = Context<{ Bindings: Env }>

// Lax, not Strict: the callback is a top-level navigation coming from accounts.google.com
const SESSION_OPTS: CookieOptions = { path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }
const OAUTH_OPTS: CookieOptions = { path: '/api/auth', httpOnly: true, secure: true, sameSite: 'Lax' }

// The app reads this hash on load to show a sign-in error
const failed = (c: C) => c.redirect('/#signin-failed')

export async function currentUser(c: C) {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  const [row] = await db(c.env)
    .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.idHash, await hashSessionId(token)), gt(sessions.expiresAt, Date.now())))
  if (!row) deleteCookie(c, SESSION_COOKIE, SESSION_OPTS)
  return row ?? null
}

export const auth = new Hono<{ Bindings: Env }>()

auth.get('/auth/google', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({ error: { code: 'auth_unconfigured', message: 'Google sign-in is not configured' } }, 503)
  }
  const state = randomToken()
  const verifier = randomToken()
  setCookie(c, OAUTH_COOKIE, `${state}.${verifier}`, { ...OAUTH_OPTS, maxAge: OAUTH_TTL_S })
  return c.redirect(
    authUrl({
      clientId: c.env.GOOGLE_CLIENT_ID,
      redirectUri: callbackUrl(c.req.url),
      state,
      challenge: await pkceChallenge(verifier),
    }),
  )
})

auth.get('/auth/google/callback', async (c) => {
  const [state, verifier] = (getCookie(c, OAUTH_COOKIE) ?? '').split('.')
  deleteCookie(c, OAUTH_COOKIE, OAUTH_OPTS)

  // Cancelling on Google's consent screen is not an error worth showing
  if (c.req.query('error') === 'access_denied') return c.redirect('/')
  const code = c.req.query('code')
  if (!state || !verifier || !code || c.req.query('state') !== state) return failed(c)

  let profile
  try {
    const idToken = await exchangeCode({
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      redirectUri: callbackUrl(c.req.url),
      code,
      verifier,
    })
    profile = profileFromClaims(decodeIdToken(idToken), c.env.GOOGLE_CLIENT_ID, Date.now())
  } catch (err) {
    console.error(err)
    return failed(c)
  }
  if (!profile) return failed(c)

  const d = db(c.env)
  const now = Date.now()
  const fields = { email: profile.email, name: profile.name, avatarUrl: profile.picture, lastLoginAt: now }
  const [user] = await d
    .insert(users)
    .values({ id: crypto.randomUUID(), googleSub: profile.sub, createdAt: now, ...fields })
    .onConflictDoUpdate({ target: users.googleSub, set: fields })
    .returning({ id: users.id })

  // A fresh session on every sign-in; drop the one this browser had (if any) and the user's expired ones
  const token = randomToken()
  const previous = getCookie(c, SESSION_COOKIE)
  const expired = and(eq(sessions.userId, user.id), lt(sessions.expiresAt, now))
  await d.batch([
    d.delete(sessions).where(previous ? or(expired, eq(sessions.idHash, await hashSessionId(previous))) : expired),
    d.insert(sessions).values({ idHash: await hashSessionId(token), userId: user.id, expiresAt: now + SESSION_TTL_MS, createdAt: now }),
  ])
  setCookie(c, SESSION_COOKIE, token, { ...SESSION_OPTS, maxAge: SESSION_TTL_MS / 1000 })
  return c.redirect('/')
})

// POST, so a link or image elsewhere cannot sign anyone out; SameSite=Lax keeps the cookie off cross-site POSTs
auth.post('/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await db(c.env).delete(sessions).where(eq(sessions.idHash, await hashSessionId(token)))
  deleteCookie(c, SESSION_COOKIE, SESSION_OPTS)
  return c.body(null, 204)
})

// Guests get { user: null } with 200, not 401: being signed out is a normal state here
auth.get('/me', async (c) => c.json({ user: await currentUser(c) }))
