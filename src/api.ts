import { useEffect, useState } from 'react'
import { RECIPE_CONTENT, isPhotoNonce, parseRecipeContent, parseReportsResponse, type RecipeEntry, type Report } from './data'
import { parseCoffees, type MyCoffee } from './coffees'
import type { Sender } from './sync'

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

// The signed-in user's reports and working recipes. Throws on any failure (with .status when the API
// answered); the caller keeps showing its cached copy.
export async function fetchReports(signal: AbortSignal): Promise<{ reports: Report[]; working: Record<string, string>; coffees: MyCoffee[] }> {
  const raw = await getJson('/api/reports', signal)
  return { ...parseReportsResponse(raw), coffees: parseCoffees((raw as { coffees?: unknown }).coffees) }
}

async function send(method: 'POST' | 'PUT', path: string, body: unknown) {
  const res = await fetch(path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw Object.assign(new Error(`${method} ${path}: ${res.status}`), { status: res.status })
}

// Writes for src/sync.ts. All are safe to repeat: report and coffee ids come from the client.
export const sender: Sender = {
  postReports: (reports, imported) => send('POST', '/api/reports', { reports, imported }),
  putWorking: (reportId) => send('PUT', '/api/working-recipes', { reportId }),
  postCoffees: (coffees) => send('POST', '/api/coffees', { coffees }),
}

// Report photos (worker/photos.ts). Owner-only: the session cookie goes along like with any same-origin request.
export const photoUrl = (reportId: string, photo: string) => `/api/reports/${encodeURIComponent(reportId)}/photo/${photo}`

/** Uploads an already resized JPEG (src/photo.ts) and returns the new photo's nonce. Throws with .status. */
export async function putPhoto(reportId: string, jpeg: Blob): Promise<string> {
  const path = `/api/reports/${encodeURIComponent(reportId)}/photo`
  const res = await fetch(path, { method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'image/jpeg' }, body: jpeg })
  if (!res.ok) throw Object.assign(new Error(`PUT ${path}: ${res.status}`), { status: res.status })
  const { photo } = (await res.json()) as { photo?: unknown }
  if (!isPhotoNonce(photo)) throw new Error(`PUT ${path}: no photo in the answer`)
  return photo
}

export async function deletePhoto(reportId: string) {
  const path = `/api/reports/${encodeURIComponent(reportId)}/photo`
  const res = await fetch(path, { method: 'DELETE', headers: { Accept: 'application/json' } })
  if (!res.ok) throw Object.assign(new Error(`DELETE ${path}: ${res.status}`), { status: res.status })
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
