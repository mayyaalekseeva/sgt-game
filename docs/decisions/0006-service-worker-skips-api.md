# 0006. The PWA service worker never touches /api/*

Status: Accepted (2026-11-03, PR #36)

## Context

The app is an installable PWA (vite-plugin-pwa, injectManifest, `src/sw.ts`). A service worker that
caches or rewrites API requests could serve stale reports, keep a signed-out session alive, or break
the Google OAuth redirects.

## Decision

`swRoute` in `src/sw-route.ts` (pure, tested) sorts every request:

- `network`: `/api` and `/api/*`, non-GET requests, other origins, and navigations to anything but the
  app page. The service worker stops the event before Workbox sees it, so the browser goes to the network
  as if there were no service worker.
- `shell`: navigations to `/` or `/index.html`. Network-first, falling back to the precached copy offline.
- `precache`: everything else, served from the build's precache when listed there.

## Consequences

- API responses are never cached, so data, the session cookie and the OAuth redirects behave as without
  a service worker.
- Offline, the app shell opens, but API calls fail. Guests keep working from localStorage, and signed-in
  writes wait in the outbox (`src/sync.ts`) until the network is back.
- A new deploy shows on the next load (network-first shell, `no-cache` on `/`, `/sw.js` and the manifest).
  The update banner never reloads during a brew timer (`src/sw-update.ts`).
- There is no service worker in dev, so service-worker behaviour is tested with `npm run build` and
  `npm run preview`.
