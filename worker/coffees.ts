import { PROCESSES, ROASTS, type coffees } from './db/schema'

// A coffee as the client stores it (src/coffees.ts MyCoffee)
export interface CoffeeIn {
  id: string
  roaster: string
  origin: string
  process: (typeof PROCESSES)[number]
  roast: (typeof ROASTS)[number]
  name: string | null
  archived: boolean
  updatedAt: number
}

export const MAX_COFFEES = 200
const ID = /^[0-9a-f]{32}$/
const MAX_TEXT = 60
const EARLIEST_TS = Date.UTC(2024, 0, 1)
const DAY = 24 * 60 * 60 * 1000

const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= MAX_TEXT
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T)

/** Validates a POST /api/coffees body: { coffees: [...] }. */
export function parseCoffeeBatch(body: unknown, now = Date.now()): { coffees: CoffeeIn[] } | { error: string } {
  const list = (body as { coffees?: unknown } | null)?.coffees
  if (!Array.isArray(list)) return { error: 'expected { coffees: [...] }' }
  if (list.length === 0 || list.length > MAX_COFFEES) return { error: `send 1 to ${MAX_COFFEES} coffees` }
  const out: CoffeeIn[] = []
  for (const [i, c] of (list as Record<string, unknown>[]).entries()) {
    const at = `coffees[${i}]`
    if (typeof c !== 'object' || c === null) return { error: `${at}: expected an object` }
    if (typeof c.id !== 'string' || !ID.test(c.id)) return { error: `${at}.id is invalid` }
    if (!text(c.roaster)) return { error: `${at}.roaster is required` }
    if (!text(c.origin)) return { error: `${at}.origin is required` }
    if (!oneOf(PROCESSES, c.process)) return { error: `${at}.process is invalid` }
    if (!oneOf(ROASTS, c.roast)) return { error: `${at}.roast is invalid` }
    if (c.name != null && c.name !== '' && !text(c.name)) return { error: `${at}.name is invalid` }
    if (c.archived != null && typeof c.archived !== 'boolean') return { error: `${at}.archived is invalid` }
    if (!Number.isInteger(c.updatedAt) || (c.updatedAt as number) < EARLIEST_TS || (c.updatedAt as number) > now + DAY) {
      return { error: `${at}.updatedAt is out of range` }
    }
    out.push({
      id: c.id,
      roaster: c.roaster.trim(),
      origin: c.origin.trim(),
      process: c.process,
      roast: c.roast,
      name: typeof c.name === 'string' && c.name.trim() !== '' ? c.name.trim() : null,
      archived: c.archived === true,
      updatedAt: c.updatedAt as number,
    })
  }
  return { coffees: out }
}

export const toCoffeeRow = (c: CoffeeIn, userId: string, now: number): typeof coffees.$inferInsert => ({
  userId,
  id: c.id,
  roaster: c.roaster,
  origin: c.origin,
  process: c.process,
  roast: c.roast,
  name: c.name,
  archived: c.archived,
  updatedAt: c.updatedAt,
  createdAt: now,
})

// GET /api/reports `coffees` -> the client's MyCoffee (src/coffees.ts parseCoffee)
export const toCoffeeOut = (r: typeof coffees.$inferSelect) => ({
  id: r.id,
  roaster: r.roaster,
  origin: r.origin,
  process: r.process,
  roast: r.roast,
  ...(r.name ? { name: r.name } : {}),
  ...(r.archived ? { archived: true } : {}),
  updatedAt: r.updatedAt,
})

/** The working-recipe key the client uses (src/coffees.ts workingKey): the slug, plus "|lot" for a coffee. */
export const workingKey = (recipeSlug: string, lot: string) => (lot ? `${recipeSlug}|${lot}` : recipeSlug)
