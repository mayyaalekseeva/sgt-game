# 0002. Hash routing, with no SPA fallback

Status: Accepted (2026-10-27, PR #4)

## Context

Back, forward, refresh and shared links should all land on the same screen. The app is served as static
assets by the Worker (see [0001](0001-single-cloudflare-worker.md)), so a path-based router would need
every app path to fall back to `index.html`.

## Decision

Keep the current screen in the URL hash (`#/profile/diary`, `#/orders/drills/extraction`). Parsing is a
pure, tested function in `src/route.ts`. Anything it does not recognise, such as an empty hash, an old link
or `#signin-failed`, opens the home screen (Orders).

The Worker's asset config has no SPA fallback: the comment in `wrangler.jsonc` notes that hash routing only
ever requests `/`, so unknown paths 404.

## Consequences

- Only `/` (and `/index.html`) is ever loaded as a page, so the `no-cache` headers on `/` and the service
  worker's network-first shell rule cover every screen.
- Server redirects into the app point at `/` with a hash, as the Google sign-in callback does
  (`/#signin-failed`, `worker/auth-routes.ts`).
- A mistyped path gets a 404 rather than the app.
- URLs carry a `#`. Whether this matters for sharing or search is **to verify**: the code does not say.
