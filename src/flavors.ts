// What the player tasted, from a small coffee flavor wheel: one of a family's specifics ("fruity.berry"). The picker
// offers only specifics; a bare family ("fruity") is still a valid id, for lot tags like "ripe fruit".
// A report stores the ids, so never rename or remove one; add new ones freely.
// Labels are in src/i18n.ts as flavor.<id>.

export interface Family {
  id: string
  specifics: string[] // ids without the family: 'berry' is stored as 'fruity.berry'
  // A third tier, for the cupping descriptors only (src/cupping-descriptors.ts): 'blackberry' under 'berry' is stored as
  // 'fruity.berry.blackberry'. Brew reports pick specifics only, so their ids and the server's check stay two-level.
  deep?: Record<string, string[]>
  off?: true // a defect rather than a flavor, shown apart
}

export const FAMILIES: Family[] = [
  {
    id: 'fruity',
    specifics: ['berry', 'citrus', 'stone_fruit', 'apple_pear', 'tropical', 'dried_fruit'],
    deep: {
      berry: ['blackberry', 'raspberry', 'blueberry', 'strawberry', 'black_currant'],
      citrus: ['lemon', 'lime', 'orange', 'grapefruit', 'bergamot'],
      stone_fruit: ['peach', 'apricot', 'plum', 'cherry'],
      apple_pear: ['green_apple', 'red_apple', 'pear'],
      tropical: ['pineapple', 'mango', 'passion_fruit', 'lychee'],
      dried_fruit: ['raisin', 'prune', 'date', 'fig'],
    },
  },
  { id: 'floral', specifics: ['jasmine', 'tea', 'rose', 'elderflower'], deep: { tea: ['black_tea', 'chamomile'] } },
  { id: 'sweet', specifics: ['caramel', 'honey', 'brown_sugar', 'vanilla'], deep: { brown_sugar: ['molasses', 'maple_syrup'] } },
  {
    id: 'cocoa_nutty',
    specifics: ['chocolate', 'cocoa', 'nutty'],
    deep: { chocolate: ['milk_chocolate', 'dark_chocolate'], nutty: ['almond', 'hazelnut', 'peanut'] },
  },
  { id: 'spice', specifics: ['cinnamon', 'clove', 'ginger', 'pepper', 'cardamom'] },
  { id: 'roasted', specifics: ['toasty', 'smoky', 'cereal', 'tobacco'] },
  { id: 'green', specifics: ['herbal', 'grassy', 'vegetal'] },
  { id: 'fermented', specifics: ['winey', 'boozy', 'overripe'] },
  { id: 'off', specifics: ['papery', 'rubbery', 'ashy', 'moldy', 'musty', 'earthy', 'phenolic', 'rio', 'potato', 'stale'], off: true },
]

export const MAX_FLAVORS = 5

export const FLAVORS: string[] = FAMILIES.flatMap((f) => [f.id, ...f.specifics.map((s) => `${f.id}.${s}`)])

/** The third tier, like "fruity.berry.blackberry": for cupping descriptors only, so not in FLAVORS. */
export const DEEP_FLAVORS: string[] = FAMILIES.flatMap((f) => Object.entries(f.deep ?? {}).flatMap(([s, list]) => list.map((d) => `${f.id}.${s}.${d}`)))

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

export const SUGGESTED = 6

/**
 * Quick picks: the roaster's notes for this coffee, then the flavors of your recent brews (newest first), each once.
 * Specifics only, like the picker; off-notes are never suggested.
 */
export function suggestFlavors(roaster: string[], recent: string[][], max = SUGGESTED): string[] {
  const ok = (id: string) => id.includes('.') && familyOf(id) !== 'off' && isKnownFlavor(id)
  return [...new Set([...roaster, ...recent.flat()].filter(ok))].slice(0, max)
}

/**
 * Which of yours the roaster's notes share: the same flavor, or the same family ("fruity.citrus" and
 * "fruity.berry" are both fruity). Off-notes never match.
 */
export function sharedFlavors(yours: string[], roaster: string[]): string[] {
  const families = new Set(roaster.map(familyOf))
  return yours.filter((id) => familyOf(id) !== 'off' && (roaster.includes(id) || families.has(familyOf(id))))
}
