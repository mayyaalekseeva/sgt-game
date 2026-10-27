import { and, eq, gt } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { db } from './db/client'
import { sessions } from './db/schema'

// Set by Google sign-in (worker/auth-routes.ts); only its SHA-256 is stored (sessions.id_hash)
export const SESSION_COOKIE = 'session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export async function hashSessionId(id: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type AuthEnv = { Bindings: Env; Variables: { userId: string } }

// 401 unless the request carries a live session; sets c.var.userId
export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
  const cookie = getCookie(c, SESSION_COOKIE)
  if (!cookie) return c.json({ error: { code: 'unauthorized', message: 'Sign in required' } }, 401)
  const [session] = await db(c.env)
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.idHash, await hashSessionId(cookie)), gt(sessions.expiresAt, Date.now())))
  if (!session) return c.json({ error: { code: 'unauthorized', message: 'Sign in required' } }, 401)
  c.set('userId', session.userId)
  await next()
})
