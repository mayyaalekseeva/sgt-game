// The quick buttons under each cupping attribute, and the short note beside them.
// Fragrance/aroma, flavor and aftertaste use the flavor wheel in three tiers (src/flavors.ts): a family, one of its
// specifics, then a finer one ("fruity", "fruity.berry", "fruity.berry.blackberry"). The other attributes have a short
// list of their own. A sample stores them as `details` (attribute id -> tags and a note); never rename or remove an id.
// Labels: flavor.<id> for the wheel, cupping.d.<attribute>.<id> for the short lists (src/i18n.ts).

import { DEEP_FLAVORS, FAMILIES, FLAVORS } from './flavors'

export interface AttrDetail {
  tags?: string[]
  note?: string
}

export type Details = Record<string, AttrDetail>

export const MAX_TAGS = 8 // per attribute
export const MAX_ATTR_NOTE = 280 // like every note in the app
const MAX_ATTRS = 20

/** Attributes that offer the flavor wheel. */
export const WHEEL_ATTRS = ['fragrance', 'flavor', 'aftertaste']

/** The short lists, by attribute. */
export const SIMPLE_DESCRIPTORS: Record<string, string[]> = {
  acidity: ['bright', 'juicy', 'crisp', 'soft', 'sharp', 'sour', 'flat', 'citric', 'malic'],
  body: ['thin', 'tea_like', 'silky', 'creamy', 'round', 'syrupy', 'heavy', 'rough'],
  balance: ['balanced', 'harmonious', 'acid_led', 'bitter_led', 'body_short'],
  sweetness: ['low', 'medium', 'high', 'syrupy', 'sugarcane', 'lingering'],
  uniformity: ['even', 'one_off', 'varied'],
  clean_cup: ['clean', 'slightly_dirty', 'dirty'],
  overall: ['complex', 'memorable', 'interesting', 'simple', 'unremarkable'],
}

export type DescriptorKind = 'wheel' | 'simple' | 'none'

export const kindOf = (attr: string): DescriptorKind => (WHEEL_ATTRS.includes(attr) ? 'wheel' : attr in SIMPLE_DESCRIPTORS ? 'simple' : 'none')

/** The i18n key of a tag's label (cast to Key where it is used). */
export const tagLabelKey = (attr: string, id: string) => (kindOf(attr) === 'simple' ? `cupping.d.${attr}.${id}` : `flavor.${id}`)

const WORD = '[a-z]+(_[a-z]+)*'
const TAG = new RegExp(`^${WORD}(\\.${WORD}){0,2}$`)

// Same shape the server checks (worker/cuppings.ts): one to three lowercase words joined by dots
export const isTagId = (v: unknown): v is string => typeof v === 'string' && v.length <= 60 && TAG.test(v)

const WHEEL = new Set([...FLAVORS, ...DEEP_FLAVORS])

/** Whether this build lists the tag for the attribute; unknown ones are kept in storage but not shown. */
export const isKnownTag = (attr: string, id: string) => (kindOf(attr) === 'simple' ? (SIMPLE_DESCRIPTORS[attr] ?? []).includes(id) : kindOf(attr) === 'wheel' && WHEEL.has(id))

/** What a wheel id opens: '' is the families, a family its specifics, a specific its finer ones. */
export function childrenOf(id: string): string[] {
  if (id === '') return FAMILIES.map((f) => f.id)
  const [family, specific, deeper] = id.split('.')
  const f = FAMILIES.find((x) => x.id === family)
  if (!f || deeper !== undefined) return []
  if (specific === undefined) return f.specifics.map((s) => `${f.id}.${s}`)
  return (f.deep?.[specific] ?? []).map((d) => `${f.id}.${specific}.${d}`)
}

/** An id and every one above it: 'fruity.berry' -> ['fruity', 'fruity.berry']. */
export const chainOf = (id: string): string[] => id.split('.').map((_, i, parts) => parts.slice(0, i + 1).join('.'))

const isAbove = (ancestor: string, id: string) => id.startsWith(`${ancestor}.`)

/**
 * One tap: removes the tag if picked. A finer tag takes the place of the ones above it ("fruity" becomes "fruity.berry"),
 * and a coarser one is ignored when a finer one of its own is already picked.
 */
export function toggleTag(list: string[], id: string, max = MAX_TAGS): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id)
  if (list.some((x) => isAbove(id, x))) return list
  const kept = list.filter((x) => !isAbove(x, id))
  return kept.length >= max ? list : [...kept, id]
}

/** Well-formed tags, each once, at most MAX_TAGS; [] for anything else. */
export function cleanTags(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter(isTagId))].slice(0, MAX_TAGS)
}

/** Stored or sent details made safe: well-formed attribute ids, clean tags, a trimmed note, nothing empty. */
export function cleanDetails(v: unknown): Details {
  const out: Details = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [attr, raw] of Object.entries(v as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_ATTRS) break
    if (!/^[a-z]+(_[a-z]+)*$/.test(attr) || attr.length > 30 || !raw || typeof raw !== 'object') continue
    const { tags, note } = raw as { tags?: unknown; note?: unknown }
    const t = cleanTags(tags)
    const n = typeof note === 'string' && note.trim() !== '' && note.length <= MAX_ATTR_NOTE ? note.trim() : undefined
    if (t.length || n) out[attr] = { ...(t.length ? { tags: t } : {}), ...(n ? { note: n } : {}) }
  }
  return out
}

/** The same details with one attribute changed; an attribute left with no tags and no note is dropped. */
export function withDetail(details: Details | undefined, attr: string, change: AttrDetail): Details {
  const next = { ...(details ?? {}) }
  const merged: AttrDetail = { ...next[attr], ...change }
  if (!merged.tags?.length) delete merged.tags
  if (!merged.note) delete merged.note
  if (merged.tags || merged.note) next[attr] = merged
  else delete next[attr]
  return next
}
