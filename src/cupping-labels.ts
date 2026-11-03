import { coffeeName, myRef, type MyCoffee } from './coffees'
import { namesHidden, type CuppingSample, type CuppingSession } from './cuppings'
import type { Lang } from './data'
import type { Key } from './i18n'
import { currentLots, lotBySlug } from './lots'

// Names and numbers the cupping screens show (src/screens/Cupping.tsx, CuppingSample.tsx)

type T = (key: Key, vars?: Record<string, string | number>) => string

/** Scores as the form writes them: 84.25, 8.50 */
export const fmtScore = (n: number) => n.toFixed(2)

/** The coffee's name, or its cup code while a blind session hides names */
export function sampleName(t: T, session: CuppingSession, sample: CuppingSample, coffees: MyCoffee[]) {
  const code = sample.code ? t('cupping.cupCode', { code: sample.code }) : t('cupping.cupN', { n: session.samples.indexOf(sample) + 1 })
  if (namesHidden(session)) return code
  return coffeeName(sample.lot, coffees) ?? (sample.code ? code : t('cupping.notInApp'))
}

/** The coffee picker's options: the roaster's lots, your coffees, or one not in the app ('') */
export function coffeeGroups(t: T, lang: Lang, coffees: MyCoffee[], current: string | undefined) {
  const lots = currentLots()
  const kept = current && lotBySlug(current) && !lots.some((l) => l.slug === current) ? [lotBySlug(current)!] : []
  const yours = coffees.filter((c) => !c.archived || myRef(c.id) === current)
  return [
    { label: '', options: [{ id: '', label: t('cupping.notInApp') }] },
    { label: t('lot.roaster'), options: [...lots, ...kept].map((l) => ({ id: l.slug, label: `${l.name} · ${l.country[lang]}` })) },
    ...(yours.length ? [{ label: t('coffee.mine'), options: yours.map((c) => ({ id: myRef(c.id), label: c.name ?? `${c.roaster} · ${c.origin}` })) }] : []),
  ]
}

