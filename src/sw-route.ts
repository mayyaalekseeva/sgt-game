/**
 * What the service worker (src/sw.ts) does with a request:
 * - network: leave it alone, as if there were no service worker (the API, sign-in, other sites, writes)
 * - shell: the app page, network-first so a new deploy shows on the next load, the cached copy offline
 * - precache: served from the build's precache when listed there (hashed assets, icons), else network
 */
export type SwRoute = 'network' | 'shell' | 'precache'

/** `scope` is the service worker's scope URL (ends in /); the app lives at its root. */
export function swRoute(url: URL, method: string, mode: RequestMode, scope: string): SwRoute {
  const root = new URL(scope)
  if (method !== 'GET' || url.origin !== root.origin) return 'network'
  const path = url.pathname.slice(root.pathname.length - 1)
  // /api/* never touches a cache: data, the session cookie and the Google OAuth redirects
  if (!url.pathname.startsWith(root.pathname) || path === '/api' || path.startsWith('/api/')) return 'network'
  if (mode === 'navigate') return path === '/' || path === '/index.html' ? 'shell' : 'network'
  return 'precache'
}
