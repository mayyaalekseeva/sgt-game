# Barista Game

Mobile-first web app that helps baristas brew better coffee, avoid common mistakes and refine recipes.
Portfolio project. Runs as one Cloudflare Worker: the static app plus a small API under `/api/*` (Hono). Guest progress is stored in the browser (localStorage); Google sign-in is optional. EN / PT.

## Run

    npm install
    npm run db:migrate:local && npm run db:seed:local   # once, and after new migrations or recipe versions
    npm run dev       # http://localhost:5173, app + Worker together (use --host to open from your phone on the same Wi-Fi)
    npm run build     # typecheck app + worker, output in dist/client (app) and dist/barista_game (Worker)
    npm run preview   # serve the build in the local Workers runtime
    npm run cf:types  # regenerate worker-configuration.d.ts after changing wrangler.jsonc

Check the API with `curl http://localhost:5173/api/health`: it reports `db.recipeVersions`, which is 0 until the migrate and seed commands have run. `GET /api/recipes` returns the seeded recipes with every version, in the same shape as `content/recipes.json`. Local D1 data lives in `.wrangler/state` (gitignored).

## Google sign-in

Optional for players: guests keep their progress in the browser. Signing in creates a `users` row (keyed by the Google `sub`) and a 30-day session. The session cookie is `HttpOnly`, `Secure` and `SameSite=Lax`, and only its SHA-256 is stored in `sessions`.

Routes: `GET /api/auth/google` (redirects to Google), `GET /api/auth/google/callback`, `POST /api/auth/logout`, `GET /api/me` (`{ user }`, or `{ user: null }` for guests).

### Google Cloud setup (once)

1. [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **OAuth consent screen**: set it up as External, with the `openid`, `email` and `profile` scopes.
2. **Credentials** > **Create credentials** > **OAuth client ID**, type **Web application**.
3. Authorized redirect URIs, one per origin the app runs on:
   - `http://localhost:5173/api/auth/google/callback` (dev)
   - `https://barista-game.<subdomain>.workers.dev/api/auth/google/callback` (production, and any custom domain)

### Local

    cp .dev.vars.example .dev.vars   # then fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

`.dev.vars` is gitignored and read by `npm run dev`. Without it the app runs normally, but `/api/auth/google` answers 503. Test sign-in in Chrome or Firefox: Safari does not keep `Secure` cookies on `http://localhost`.

### Production

    npx wrangler secret put GOOGLE_CLIENT_ID
    npx wrangler secret put GOOGLE_CLIENT_SECRET
    npm run db:migrate:remote

Both secrets are listed under `secrets.required` in `wrangler.jsonc`, so `wrangler types` includes them in `Env`.

## Deploy (Cloudflare Workers, free plan)

Config lives in `wrangler.jsonc`. `vite build` writes the deployable config to `dist/barista_game/wrangler.json`, and `wrangler deploy` picks it up.

### From your machine

    npx wrangler login
    npm run deploy    # build + wrangler deploy, live at https://barista-game.<subdomain>.workers.dev

Set the Google secrets first (see [Production](#production) above), or sign-in answers 503.

### From Git (Workers Builds)

1. Push the repo to GitHub or GitLab.
2. Cloudflare dashboard > **Workers & Pages** > **Create application** > **Import a repository**, pick the repo.
3. Build command: `npm run build`. Deploy command: `npx wrangler deploy`. Root directory: this folder if the app sits in a subfolder of the repo.
4. Set `NODE_VERSION` = `22` if the build image needs it (Vite 8 needs Node 20.19+ or 22.12+).

The app uses hash routing, so only `/` is ever requested and there is no SPA fallback: unknown paths 404.

### Before merging

Merging to `main` deploys it. The deploy fails, or the API breaks, if the infrastructure it expects is missing, so for any PR that adds a binding or a migration, do this first, in this order:

1. **Create new buckets and databases.** R2 bucket for report photos: Cloudflare dashboard > **R2** > **Create bucket**, name `barista-photos` (or `npx wrangler r2 bucket create barista-photos`). Keep it private: no public access, no r2.dev URL. Photos are served only through `/api/reports/:id/photo/:nonce`, to their owner.
2. **Apply new migrations to the remote D1** before `main` is deployed: `npm run db:migrate:remote`. Migrations only add columns or tables, so the running version keeps working with the new schema. Migration `0007_report_photo` adds `reports.photo_key` and `reports.visibility`; `0008_report_edit_delete` adds `reports.edited_at` and the `deleted_reports` table.
3. Only then merge the PR.

### Cache headers

`public/_headers` is copied into `dist/client/` and applied to static assets (not to `/api/*`, whose headers are set in `worker/app.ts`):

- `/assets/*` (hashed by Vite): cached for a year, `immutable`
- `/brand/*` (stable names): cached a day, then revalidated in the background
- `/` and `/index.html`: `no-cache`, so a new deploy is picked up immediately

Check after deploying with `curl -I https://barista-game.<subdomain>.workers.dev/assets/<file>.js`.

## Where things are

- `worker/`: the API Worker (`index.ts` entry, `app.ts` Hono routes under `/api`, `db/` Drizzle schema and client)
- `worker/auth.ts`, `worker/auth-routes.ts`, `worker/google.ts`: sessions, sign-in routes, Google OAuth helpers; `src/auth.tsx` on the client
- `content/recipes.json`: recipe content, versioned and append-only; bundled into the app and seeded into D1
- `migrations/`: SQL generated by `npm run db:generate`, applied with `npm run db:migrate:local` (or `:remote`)
- `scripts/seed-recipes.mjs`: loads the recipe content into D1 (`npm run db:seed:local` / `:remote`)
- `worker/photos.ts`: report photos in R2 (binding `PHOTOS`): keys, size limit, the metadata check; `src/photo.ts` resizes and re-encodes on the client. iPhone HEIC photos that the browser cannot open (Chrome on Windows or Android) are decoded with [heic-to](https://github.com/hoppergee/heic-to) (libheif, LGPL-3.0), loaded as its own chunk only when needed
- `wrangler.jsonc`: Worker config; `worker-configuration.d.ts` is generated by `npm run cf:types`
- `src/data.ts`: recipe content parsing and validation, ranks, missions (recipes are starting points, to verify with the roaster)
- `src/diagnose.ts`: rule-based diagnosis (taste + time vs. recipe range -> one change)
- `src/i18n.ts`: all EN/PT texts
- `src/api.ts`: reads the API, falling back to the browser (bundled recipes, guest reports in localStorage); `src/reports.tsx` loads the reports once for Profile, Diary and Saved recipes
- `src/account.tsx`: account card and language switch
- `src/route.ts`: the current screen in the URL hash (`#/profile/diary`), so back, refresh and links work
- `src/screens/`: the tabs Orders, Diagnose, Recipes, Profile; Profile opens Saved recipes, Diary (one timeline, filtered by coffee, with what changed since the previous brew), Missions and Dossier
- `public/brand/`: logo and photos (used with the roaster's permission)

## Next

Waiting on the roaster:
- Per-lot recipes: a lot is picked and stored with each report, but the recipe doesn't change yet (one placeholder recipe per brewer/roast)
- Which roasts (espresso, filter or both) each lot in `content/lots.json` has
- Real Dossier texts, and a check of the recipe ranges and diagnosis thresholds

Can be done now:
- More filter brewers: Kalita, Chemex, Clever
