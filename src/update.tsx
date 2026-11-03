import { useEffect, useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useStore } from './store'
import { NO_UPDATE, showUpdate, updateStep, type UpdateEvent } from './sw-update'

// The service worker (src/sw.ts) is registered once per page, outside React; the banner subscribes.
// In dev there is no worker and nothing happens.
let update = NO_UPDATE
let timing = false
const subs = new Set<() => void>()

function send(e: UpdateEvent) {
  const { next, effect } = updateStep(update, e, timing)
  if (next !== update) {
    update = next
    subs.forEach((f) => f())
  }
  if (effect === 'skip-waiting') void updateSW()
  if (effect === 'reload-page') location.reload()
}

const updateSW = registerSW({
  onNeedRefresh: () => send('waiting'),
  // the new worker took over; vite-plugin-pwa would reload here, updateStep decides instead
  onNeedReload: () => send('controlling'),
  // an installed app can stay open for days: look for a new version whenever it comes back to the front
  onRegisteredSW: (_url, r) => {
    if (!r) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') r.update().catch(() => {})
    })
  },
})

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

// Above the screen, like the sign-in alert: a new version is in, reload when it suits you
export function UpdateBanner() {
  const { t, timer } = useStore()
  const u = useSyncExternalStore(subscribe, () => update)
  useEffect(() => {
    timing = timer !== null
  }, [timer])
  if (!showUpdate(u, timer !== null)) return null
  return (
    <div role="status" className="mb-4 flex items-center gap-3 rounded-xl border-2 border-ink bg-cream p-3">
      <p className="flex-1 text-[15px] text-ink">{t('update.ready')}</p>
      <button
        type="button"
        onClick={() => send('reload')}
        className="flex h-11 flex-none items-center rounded-lg bg-olive px-4 text-[15px] font-semibold text-cream active:scale-[0.98]"
      >
        {t('update.reload')}
      </button>
    </div>
  )
}
