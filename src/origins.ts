import type { Lang } from './data'

export type Continent = 'africa' | 'asia' | 'americas' | 'oceania'

// A blend has no continent
export type Origin = Record<Lang, string> & { continent?: Continent }

// Where coffee comes from, for the origin picker on your own coffees. The chosen name is stored as text
// in the language it was picked in, like the rest of a coffee's details. Hawaii counts as the Americas, Yemen as Asia.
export const ORIGINS: Origin[] = [
  { en: 'Angola', pt: 'Angola' , continent: 'africa' },
  { en: 'Australia', pt: 'Austrália' , continent: 'oceania' },
  { en: 'Blend', pt: 'Blend' },
  { en: 'Bolivia', pt: 'Bolívia' , continent: 'americas' },
  { en: 'Brazil', pt: 'Brasil' , continent: 'americas' },
  { en: 'Burundi', pt: 'Burundi' , continent: 'africa' },
  { en: 'Cameroon', pt: 'Camarões' , continent: 'africa' },
  { en: 'Cape Verde', pt: 'Cabo Verde' , continent: 'africa' },
  { en: 'China', pt: 'China' , continent: 'asia' },
  { en: 'Colombia', pt: 'Colômbia' , continent: 'americas' },
  { en: 'Congo (DRC)', pt: 'Congo (RDC)' , continent: 'africa' },
  { en: 'Costa Rica', pt: 'Costa Rica' , continent: 'americas' },
  { en: 'Cuba', pt: 'Cuba' , continent: 'americas' },
  { en: 'Dominican Republic', pt: 'República Dominicana' , continent: 'americas' },
  { en: 'Ecuador', pt: 'Equador' , continent: 'americas' },
  { en: 'El Salvador', pt: 'El Salvador' , continent: 'americas' },
  { en: 'Ethiopia', pt: 'Etiópia' , continent: 'africa' },
  { en: 'Guatemala', pt: 'Guatemala' , continent: 'americas' },
  { en: 'Haiti', pt: 'Haiti' , continent: 'americas' },
  { en: 'Hawaii', pt: 'Havai' , continent: 'americas' },
  { en: 'Honduras', pt: 'Honduras' , continent: 'americas' },
  { en: 'India', pt: 'Índia' , continent: 'asia' },
  { en: 'Indonesia', pt: 'Indonésia' , continent: 'asia' },
  { en: 'Jamaica', pt: 'Jamaica' , continent: 'americas' },
  { en: 'Kenya', pt: 'Quénia' , continent: 'africa' },
  { en: 'Laos', pt: 'Laos' , continent: 'asia' },
  { en: 'Malawi', pt: 'Malawi' , continent: 'africa' },
  { en: 'Mexico', pt: 'México' , continent: 'americas' },
  { en: 'Myanmar', pt: 'Myanmar' , continent: 'asia' },
  { en: 'Nepal', pt: 'Nepal' , continent: 'asia' },
  { en: 'Nicaragua', pt: 'Nicarágua' , continent: 'americas' },
  { en: 'Panama', pt: 'Panamá' , continent: 'americas' },
  { en: 'Papua New Guinea', pt: 'Papua-Nova Guiné' , continent: 'oceania' },
  { en: 'Peru', pt: 'Peru' , continent: 'americas' },
  { en: 'Philippines', pt: 'Filipinas' , continent: 'asia' },
  { en: 'Rwanda', pt: 'Ruanda' , continent: 'africa' },
  { en: 'São Tomé and Príncipe', pt: 'São Tomé e Príncipe' , continent: 'africa' },
  { en: 'Taiwan', pt: 'Taiwan' , continent: 'asia' },
  { en: 'Tanzania', pt: 'Tanzânia' , continent: 'africa' },
  { en: 'Thailand', pt: 'Tailândia' , continent: 'asia' },
  { en: 'Timor-Leste', pt: 'Timor-Leste' , continent: 'asia' },
  { en: 'Uganda', pt: 'Uganda' , continent: 'africa' },
  { en: 'Venezuela', pt: 'Venezuela' , continent: 'americas' },
  { en: 'Vietnam', pt: 'Vietname' , continent: 'asia' },
  { en: 'Yemen', pt: 'Iémen' , continent: 'asia' },
  { en: 'Zambia', pt: 'Zâmbia' , continent: 'africa' },
  { en: 'Zimbabwe', pt: 'Zimbabwe' , continent: 'africa' },
]

// "etiopia" finds Etiópia: case and accents do not matter
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()

/** The origins for the picker in this language, alphabetical, filtered by what was typed. */
export function searchOrigins(query: string, lang: Lang): string[] {
  const q = fold(query)
  const names = ORIGINS.map((o) => o[lang]).sort((a, b) => a.localeCompare(b, lang))
  if (!q) return names
  // names that start with the query first, then the ones that contain it
  const starts = names.filter((n) => fold(n).startsWith(q))
  return [...starts, ...names.filter((n) => !starts.includes(n) && fold(n).includes(q))]
}

/** The origin a stored name means, in either language; undefined for free text that is not in the list. */
export function originOf(name: string | undefined): Origin | undefined {
  if (!name) return undefined
  const n = fold(name)
  return ORIGINS.find((o) => fold(o.en) === n || fold(o.pt) === n)
}

export const originsIn = (c: Continent) => ORIGINS.filter((o) => o.continent === c)
