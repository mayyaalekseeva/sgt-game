import { workingKey } from './coffees'
import type { Report } from './data'

// The Diary timeline: which coffees to filter by, what changed since the previous brew, and a short summary.
// Pure, so it can be tested; src/screens/Diary.tsx renders it.

/** The coffees in the reports (lot slugs or my: refs), most recently brewed first. */
export function diaryCoffees(reports: Report[]): string[] {
  const seen = new Set<string>()
  for (const r of [...reports].sort((a, b) => b.ts - a.ts)) if (r.lot) seen.add(r.lot)
  return [...seen]
}

/**
 * Each report's previous brew of the same coffee and recipe (src/coffees.ts workingKey), so a change is read
 * against the brew it followed. A coffee's first brew has none.
 */
export function previousBrews(reports: Report[]): Map<string, Report> {
  const last = new Map<string, Report>()
  const previous = new Map<string, Report>()
  for (const r of [...reports].sort((a, b) => a.ts - b.ts)) {
    const key = workingKey(r)
    const before = last.get(key)
    if (before) previous.set(r.id, before)
    last.set(key, r)
  }
  return previous
}

export type BrewChange =
  | { field: 'dose' | 'yield' | 'time'; delta: number }
  | { field: 'grinder'; from: string; to: string }
  | { field: 'grinderModel'; from: string; to: string }

/**
 * What changed from one brew to the next: the numbers, and the grinder when both brews name it. A setting is only
 * compared on the same grinder: on another one, the new grinder is the change. Empty: the same recipe.
 */
export function brewChanges(prev: Report, cur: Report): BrewChange[] {
  const changes: BrewChange[] = []
  for (const field of ['dose', 'yield', 'time'] as const) {
    const delta = Math.round((cur[field] - prev[field]) * 10) / 10
    if (delta !== 0) changes.push({ field, delta })
  }
  if (prev.grinderModel && cur.grinderModel && prev.grinderModel !== cur.grinderModel) {
    changes.push({ field: 'grinderModel', from: prev.grinderModel, to: cur.grinderModel })
  } else if (prev.grinder && cur.grinder && prev.grinder !== cur.grinder) {
    changes.push({ field: 'grinder', from: prev.grinder, to: cur.grinder })
  }
  return changes
}

export const WEEK = 7 * 24 * 60 * 60 * 1000

/** Brews and balanced ones, over the reports given (the last 7 days, or one coffee's). */
export function diarySummary(reports: Report[]) {
  return { brews: reports.length, balanced: reports.filter((r) => r.taste === 'balanced').length }
}

/** The reports of the last 7 days, for the summary with no coffee picked. */
export const lastWeek = (reports: Report[], now: number) => reports.filter((r) => r.ts > now - WEEK && r.ts <= now)
