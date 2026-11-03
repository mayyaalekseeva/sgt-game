/** Where an update to a new version of the app stands in this tab (src/update.tsx). */
export interface Update {
  phase: 'none' | 'waiting' | 'active' // a new service worker is installed and waiting / has taken over
  asked: boolean // the player tapped Reload in this tab
}

// waiting: a new worker is waiting. reload: the player tapped Reload.
// controlling: the new worker took over, from this tab or from another one.
export type UpdateEvent = 'waiting' | 'reload' | 'controlling'
export type UpdateEffect = 'skip-waiting' | 'reload-page' | null

export const NO_UPDATE: Update = { phase: 'none', asked: false }

/**
 * The page only reloads when the player asked for it in this tab, and never while a brew is being
 * timed (the timer lives in memory and a reload would lose it). A worker activated from another tab
 * leaves this one as it is, with the banner still offering the reload.
 */
export function updateStep(u: Update, e: UpdateEvent, timing: boolean): { next: Update; effect: UpdateEffect } {
  switch (e) {
    case 'waiting':
      return { next: { phase: 'waiting', asked: false }, effect: null }
    case 'reload':
      if (timing || u.phase === 'none') return { next: u, effect: null }
      if (u.phase === 'active') return { next: u, effect: 'reload-page' }
      return { next: { ...u, asked: true }, effect: 'skip-waiting' }
    case 'controlling':
      if (u.asked && !timing) return { next: { phase: 'active', asked: false }, effect: 'reload-page' }
      return { next: { phase: 'active', asked: false }, effect: null }
  }
}

/** The banner shows once a new version is in, but not over a running brew timer. */
export const showUpdate = (u: Update, timing: boolean) => u.phase !== 'none' && !timing
