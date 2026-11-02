// What the player tasted, from a small coffee flavor wheel: one of a family's specifics ("fruity.berry"). The picker
// offers only specifics; a bare family ("fruity") is still a valid id, for lot tags like "ripe fruit".
// A report stores the ids, so never rename or remove one; add new ones freely.
// Labels are in src/i18n.ts as flavor.<id>.

export interface Family {
  id: string
  specifics: string[] // ids without the family: 'berry' is stored as 'fruity.berry'
  off?: true // a defect rather than a flavor, shown apart
}

export const FAMILIES: Family[] = [
  { id: 'fruity', specifics: ['berry', 'citrus', 'stone_fruit', 'apple_pear', 'tropical', 'dried_fruit'] },
  { id: 'floral', specifics: ['jasmine', 'tea'] },
  { id: 'sweet', specifics: ['caramel', 'honey', 'brown_sugar', 'vanilla'] },
  { id: 'cocoa_nutty', specifics: ['chocolate', 'cocoa', 'nutty'] },
  { id: 'spice', specifics: ['cinnamon', 'clove', 'ginger'] },
  { id: 'roasted', specifics: ['toasty', 'smoky'] },
  { id: 'green', specifics: ['herbal', 'grassy'] },
  { id: 'fermented', specifics: ['winey', 'boozy'] },
  { id: 'off', specifics: ['papery', 'rubbery', 'ashy'], off: true },
]

export const MAX_FLAVORS = 5

export const FLAVORS: string[] = FAMILIES.flatMap((f) => [f.id, ...f.specifics.map((s) => `${f.id}.${s}`)])

// Same as the server (worker/reports.ts isFlavorId). An id this build does not list is kept: a newer build added it.
export const isFlavorId = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 40 && /^[a-z]+(_[a-z]+)*(\.[a-z]+(_[a-z]+)*)?$/.test(v)

export const isKnownFlavor = (id: string) => FLAVORS.includes(id)

export const familyOf = (id: string) => id.split('.')[0]

/** Well-formed ids, each once, at most MAX_FLAVORS; [] for anything else. */
export function cleanFlavors(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter(isFlavorId))].slice(0, MAX_FLAVORS)
}

/** Tapping a flavor: removes it if picked. A specific replaces its bare family, so "fruity" becomes "fruity.berry". */
export function toggleFlavor(list: string[], id: string): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id)
  const family = familyOf(id)
  if (family !== id && list.includes(family)) return list.map((x) => (x === family ? id : x))
  return list.length >= MAX_FLAVORS ? list : [...list, id]
}

/**
 * Which of yours the roaster's notes share: the same flavor, or the same family ("fruity.citrus" and
 * "fruity.berry" are both fruity). Off-notes never match.
 */
export function sharedFlavors(yours: string[], roaster: string[]): string[] {
  const families = new Set(roaster.map(familyOf))
  return yours.filter((id) => familyOf(id) !== 'off' && (roaster.includes(id) || families.has(familyOf(id))))
}
