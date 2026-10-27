import { describe, expect, it } from 'vitest'
import { toRecipeContent } from '../worker/recipes'
import { RECIPE_CONTENT, parseRecipeContent } from './data'

// The rows scripts/seed-recipes.mjs writes for the content file
const recipeRows = RECIPE_CONTENT.map((e) => ({ slug: e.slug, method: e.method, roast: e.roast, status: e.status, createdAt: 0, updatedAt: 0 }))
const versionRows = RECIPE_CONTENT.flatMap((e) =>
  e.versions.map((v) => ({
    id: v.id,
    recipeSlug: e.slug,
    version: v.version,
    dose: v.dose,
    yieldG: v.yield,
    timeMin: v.time[0],
    timeMax: v.time[1],
    tempMin: v.temp[0],
    tempMax: v.temp[1],
    publishedAt: v.publishedAt,
    createdAt: 0,
  })),
)

describe('GET /api/recipes body (toRecipeContent)', () => {
  it('round-trips the seeded content through the client parser', () => {
    expect(parseRecipeContent(toRecipeContent(recipeRows, versionRows), 'GET /api/recipes')).toEqual(RECIPE_CONTENT)
  })

  it('orders versions ascending whatever order the database returns them in', () => {
    const v1 = versionRows.find((v) => v.recipeSlug === 'espresso-dark')!
    const v2 = { ...v1, id: 'espresso-dark@2', version: 2, dose: 19, publishedAt: '2026-11-01' }
    const body = toRecipeContent(recipeRows, [v2, ...versionRows])
    const parsed = parseRecipeContent(body).find((e) => e.slug === 'espresso-dark')!
    expect(parsed.versions.map((v) => [v.id, v.dose])).toEqual([
      ['espresso-dark@1', 18],
      ['espresso-dark@2', 19],
    ])
  })

  it('names the API in validation errors', () => {
    expect(() => parseRecipeContent(toRecipeContent(recipeRows.slice(1), versionRows), 'GET /api/recipes')).toThrow(/^GET \/api\/recipes: /)
  })
})
