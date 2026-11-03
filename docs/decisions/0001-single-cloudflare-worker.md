# 0001. One Cloudflare Worker for the app and the API, not Pages Functions

Status: Accepted (2026-10-26, initial commit)

## Context

The app is a static Vite build plus a small API (Hono) for sign-in, synced reports, coffees and photos,
backed by D1 and R2. Cloudflare can host this either as Pages with Pages Functions or as one Worker
that serves static assets.

## Decision

Run everything as a single Worker (`wrangler.jsonc`, entry `worker/index.ts`). The Worker serves the
Vite client build as static assets and runs first only for `/api/*` (`assets.run_worker_first`).
`@cloudflare/vite-plugin` runs the Worker in the Workers runtime during `npm run dev` and builds it next
to the client, so the app and the API share one origin and one port, locally and in production.

Why Workers rather than Pages: **to verify**. The code and comments name the choice ("not Pages
Functions" in CLAUDE.md) but do not give a reason.

## Consequences

- One deploy (`npm run deploy`, or Workers Builds on merge) ships the app and the API together.
- Same origin for the app and `/api/*`, so the session cookie needs no CORS setup.
- Bindings (D1 `DB`, R2 `PHOTOS`) and secrets are declared once in `wrangler.jsonc`;
  `npm run cf:types` regenerates their types.
- Static asset requests never run Worker code, so asset headers come from `public/_headers` and API
  headers from `worker/app.ts`.
- Workers Builds runs `wrangler preview` on non-production branches, which needs the empty `previews`
  block in `wrangler.jsonc`.
