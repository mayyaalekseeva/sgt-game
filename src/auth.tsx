import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Sign-in is optional: guests keep their progress in localStorage (store.tsx) and nothing here touches it.

export interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

// Relative like every other URL in the app (Vite base './'). A full navigation, not fetch: Google's page has to load.
export const SIGN_IN_URL = './api/auth/google'

// The Worker redirects here when the Google callback fails (worker/auth-routes.ts)
const FAILED_HASH = '#signin-failed'

interface Auth {
  user: User | null | undefined // undefined until /api/me answers
  failed: boolean
  dismissFailed: () => void
  signOut: () => Promise<void>
}

const Ctx = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [failed, setFailed] = useState(() => location.hash === FAILED_HASH)

  useEffect(() => {
    if (location.hash === FAILED_HASH) history.replaceState(null, '', location.pathname + location.search)
    let live = true
    fetch('./api/me')
      .then((r) => (r.ok ? (r.json() as Promise<{ user: User | null }>) : { user: null }))
      .then((b) => live && setUser(b.user))
      // No API (offline, static host): carry on as a guest
      .catch(() => live && setUser(null))
    return () => {
      live = false
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const r = await fetch('./api/auth/logout', { method: 'POST' })
      if (r.ok) setUser(null)
    } catch {
      /* still signed in; the button stays */
    }
  }, [])

  const value = useMemo<Auth>(
    () => ({ user, failed, dismissFailed: () => setFailed(false), signOut }),
    [user, failed, signOut],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider missing')
  return v
}

export const displayName = (u: User) => u.name || u.email

export const initial = (u: User) => displayName(u).trim().charAt(0).toUpperCase() || '?'
