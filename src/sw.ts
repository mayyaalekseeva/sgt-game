/// <reference lib="webworker" />
// The service worker, built by vite-plugin-pwa (injectManifest) into dist/client/sw.js.
// Which requests it touches is decided in sw-route.ts.
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { swRoute } from './sw-route'

declare const self: ServiceWorkerGlobalScope

// Added before Workbox's own fetch listener: for /api/* and anything else that is not ours it stops
// the event, so no handler calls respondWith and the browser goes to the network as without a worker.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (swRoute(new URL(request.url), request.method, request.mode, self.registration.scope) === 'network') {
    event.stopImmediatePropagation()
  }
})

// The app page: network-first, so a deploy shows on the next load (index.html is no-cache too).
// Offline, the copy precached with this worker, which matches the assets precached with it.
registerRoute(
  ({ request, url }) => swRoute(url, request.method, request.mode, self.registration.scope) === 'shell',
  async ({ request }) => {
    try {
      return await fetch(request)
    } catch {
      return (await matchPrecache('index.html')) ?? Response.error()
    }
  },
)

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// The page asks for this when the player taps Reload on the update banner
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})
