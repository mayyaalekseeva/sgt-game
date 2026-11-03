# Decisions

Short records of design choices that are hard to see from the code alone: the context, the decision, and
what follows from it. Each one is based on the code and its comments. A point marked **to verify** is
one the code does not show and that still needs the owner's confirmation.

To change a decision, add a new record that supersedes the old one and mark the old one "Superseded by
NNNN". Update these in the same PR as the code change (see CLAUDE.md).

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-single-cloudflare-worker.md) | One Cloudflare Worker for the app and the API, not Pages Functions | Accepted |
| [0002](0002-hash-routing-no-spa-fallback.md) | Hash routing, with no SPA fallback | Accepted |
| [0003](0003-progress-derived-from-reports.md) | XP and rank derived from reports, never stored | Accepted |
| [0004](0004-briefing-and-level-local-only.md) | Player level and briefing flag stored on the device only | Accepted |
| [0005](0005-append-only-recipe-versions.md) | Recipe versions are append-only | Accepted |
| [0006](0006-service-worker-skips-api.md) | The PWA service worker never touches /api/* | Accepted |
