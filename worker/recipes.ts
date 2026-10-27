import type { recipes, recipeVersions } from './db/schema'

type RecipeRow = typeof recipes.$inferSelect
type VersionRow = typeof recipeVersions.$inferSelect

// GET /api/recipes body: the same shape as content/recipes.json, so the client validates it with
// parseRecipeContent. Versions ascending, as the content file lists them.
export function toRecipeContent(rows: RecipeRow[], versions: VersionRow[]) {
  return {
    recipes: rows.map((r) => ({
      slug: r.slug,
      method: r.method,
      roast: r.roast,
      status: r.status,
      versions: versions
        .filter((v) => v.recipeSlug === r.slug)
        .sort((a, b) => a.version - b.version)
        .map((v) => ({
          version: v.version,
          publishedAt: v.publishedAt,
          dose: v.dose,
          yield: v.yieldG,
          time: [v.timeMin, v.timeMax],
          temp: [v.tempMin, v.tempMax],
        })),
    })),
  }
}
