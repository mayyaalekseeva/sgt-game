import lotContent from '../content/lots.json' with { type: 'json' }
import type { Lang } from './data'

// The roaster's flavor profile, as its shop labels each coffee
export type Profile = 'classic' | 'classic_rich' | 'classic_complex' | 'fruity_floral' | 'fruity_complex' | 'decaf'
export const PROFILES: Profile[] = ['classic', 'classic_rich', 'classic_complex', 'fruity_floral', 'fruity_complex', 'decaf']

type Text = Record<Lang, string>

/**
 * A coffee from the roaster. Every lot is sold for both filter and espresso. Recipes are not per lot yet:
 * the roaster will say how to brew each one, and then a lot will pick its own recipe.
 */
export interface Lot {
  slug: string // referenced by reports, never renamed
  name: string
  country: Text
  region: string
  variety: string
  process: Text
  altitude: [number, number] // m
  notes: Text
  profile: Profile
  status: 'current' | 'retired' // retired lots stay for older reports, out of the picker
  url: string
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

const isText = (v: unknown): v is Text =>
  typeof v === 'object' && v !== null && ['en', 'pt'].every((l) => typeof (v as Record<string, unknown>)[l] === 'string' && (v as Record<string, string>)[l] !== '')

/** Validates content/lots.json. A lot is never deleted or renamed: retire it with "status": "retired". */
export function parseLotContent(raw: unknown, source = 'content/lots.json'): Lot[] {
  const fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`)
  }
  const list = (raw as { lots?: unknown })?.lots
  if (!Array.isArray(list)) fail('expected { lots: [...] }')
  const lots = (list as Record<string, unknown>[]).map((l, i): Lot => {
    const at = typeof l.slug === 'string' ? l.slug : `lots[${i}]`
    if (typeof l.slug !== 'string' || !SLUG.test(l.slug)) fail(`${at}: slug must be lowercase words joined by "-"`)
    for (const k of ['name', 'region', 'variety'] as const) if (typeof l[k] !== 'string' || l[k] === '') fail(`${at}: ${k} is required`)
    for (const k of ['country', 'process', 'notes'] as const) if (!isText(l[k])) fail(`${at}: ${k} needs en and pt`)
    const alt = l.altitude
    if (!Array.isArray(alt) || alt.length !== 2 || !alt.every((n) => Number.isInteger(n) && n > 0) || alt[0] > alt[1]) {
      fail(`${at}: altitude must be [min, max] metres`)
    }
    if (!PROFILES.includes(l.profile as Profile)) fail(`${at}: profile must be one of ${PROFILES.join(', ')}`)
    if (l.status !== 'current' && l.status !== 'retired') fail(`${at}: status must be current or retired`)
    if (typeof l.url !== 'string' || !l.url.startsWith('https://')) fail(`${at}: url must be https`)
    return {
      slug: l.slug as string,
      name: l.name as string,
      country: l.country as Text,
      region: l.region as string,
      variety: l.variety as string,
      process: l.process as Text,
      altitude: alt as [number, number],
      notes: l.notes as Text,
      profile: l.profile as Profile,
      status: l.status as Lot['status'],
      url: l.url as string,
    }
  })
  const slugs = lots.map((l) => l.slug)
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i)
  if (dup) fail(`${dup} appears more than once`)
  return lots
}

export const LOTS = parseLotContent(lotContent)

export const lotBySlug = (slug: string | null | undefined) => (slug ? LOTS.find((l) => l.slug === slug) : undefined)

// The ones the picker offers
export const currentLots = () => LOTS.filter((l) => l.status === 'current')
