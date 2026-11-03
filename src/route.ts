// The screen lives in the URL hash, so the browser's back button, a refresh and a shared link all
// land on the same screen: #/profile, #/profile/diary, #/diag/diary, #/diag/timer, #/orders/drills/extraction.

export const TABS = ['orders', 'diag', 'recipes', 'profile'] as const
export const SUBS = ['saved', 'diary', 'missions', 'dossier', 'timer', 'coffee', 'coffees', 'lots', 'drills', 'cupping'] as const

export type Tab = (typeof TABS)[number]
export type Sub = (typeof SUBS)[number]

// A sub-screen opens over a tab, which stays highlighted and is where its back button returns
export interface Route {
  tab: Tab
  sub: Sub | null
  // one drill, under drills; under cupping a session, or "<session>.<sample>" for one coffee in it. A screen shows its
  // list for an id it does not know.
  id?: string
}

export const HOME: Route = { tab: 'orders', sub: null }

// The sub-screens that take an id, and its shape
const ID_OF: Partial<Record<Sub, RegExp>> = {
  drills: /^[a-z-]+$/,
  cupping: /^[0-9a-f]{32}(\.[0-9a-f]{32})?$/,
}

/** Anything unknown (an empty hash, #signin-failed, an old link) opens the home screen. */
export function parseRoute(hash: string): Route {
  const [tab, sub, id, ...rest] = hash.replace(/^#\/?/, '').split('/')
  if (!TABS.includes(tab as Tab) || rest.length > 0) return HOME
  if (id !== undefined && id !== '' && !(ID_OF[sub as Sub]?.test(id) ?? false)) return HOME
  if (sub === undefined || sub === '') return { tab: tab as Tab, sub: null }
  if (!SUBS.includes(sub as Sub)) return { tab: tab as Tab, sub: null }
  return id ? { tab: tab as Tab, sub: sub as Sub, id } : { tab: tab as Tab, sub: sub as Sub }
}

export const routeHash = (r: Route) => `#/${r.tab}${r.sub ? `/${r.sub}` : ''}${r.sub && r.id ? `/${r.id}` : ''}`
