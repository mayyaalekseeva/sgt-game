# 0005. Recipe versions are append-only

Status: Accepted (2026-10-26, initial commit)

## Context

Recipes will change, for example when the roaster checks them. Every report records the recipe version it
was brewed with, and the diagnosis compares a brew against that version's ranges. If a version changed
afterwards, old reports would be judged against numbers the player never saw.

## Decision

Recipe content lives in `content/recipes.json` (no admin UI). A version is identified as `slug@version`,
which is the id reports store. To change a recipe, add version N+1. Never edit or delete a published
version. Retire a recipe with `"status": "archived"`.

`scripts/seed-recipes.mjs` enforces this. If a version already in D1 differs from the file, or was
removed from it, the seed stops and asks for a new version instead. Only a recipe's `status` may change.
In the schema, `recipe_versions` rows are marked immutable once inserted (`worker/db/schema.ts`).

## Consequences

- Old reports keep meaning what they meant, and the Diary can show which version each brew used.
- `content/recipes.json` only grows. Archived per-roast filter recipes stay in it.
- A typo in a published version is fixed by publishing a new version, not by editing the old one.
- The same append-only idea is used for coffee lots: never rename or delete one, retire it with
  `"status": "retired"` (CLAUDE.md).
