import { useEffect, useState } from 'react'
import { RECIPE_CONTENT, parseRecipeContent, parseReportsResponse, type RecipeEntry, type Report } from './data'

// Where a screen's data came from: the API, or this browser (bundled recipes, guest reports)
export type Source = 'api' | 'browser'

async function getJson(path: string, signal: AbortSignal) {
  const res = await fetch(path, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw Object.assign(new Error(`${path}: ${res.status}`), { status: res.status })
  return res.json() as Promise<unknown>
}

const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError'

// Recipes are public. The bundled copy is seeded from the same file, so it stands in when the API
// is down or the database has not been seeded yet.
export async function loadRecipes(signal: AbortSignal): Promise<{ recipes: RecipeEntry[]; source: Source }> {
  try {
    return { recipes: parseRecipeContent(await getJson('/api/recipes', signal), 'GET /api/recipes'), source: 'api' }
  } catch (err) {
    if (isAbort(err)) throw err
    console.warn(err)
    return { recipes: RECIPE_CONTENT, source: 'browser' }
  }
}

// 401 means a guest; any other failure also falls back to this browser's reports, so the diary
// still opens offline.
export async function loadReports(
  signal: AbortSignal,
  local: { reports: Report[]; working: Record<string, string> },
): Promise<{ reports: Report[]; working: Record<string, string>; source: Source }> {
  try {
    return { ...parseReportsResponse(await getJson('/api/reports', signal)), source: 'api' }
  } catch (err) {
    if (isAbort(err)) throw err
    if ((err as { status?: number }).status !== 401) console.warn(err)
    return { ...local, source: 'browser' }
  }
}

// Runs load once on mount; null while loading
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal).then(setData, (err) => {
      if (!isAbort(err)) console.error(err)
    })
    return () => ctrl.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return data
}
