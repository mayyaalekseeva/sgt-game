import type { Lang } from './data'

// Where coffee comes from, for the origin picker on your own coffees. The chosen name is stored as text
// in the language it was picked in, like the rest of a coffee's details.
export const ORIGINS: Record<Lang, string>[] = [
  { en: 'Angola', pt: 'Angola' },
  { en: 'Australia', pt: 'Austrália' },
  { en: 'Blend', pt: 'Blend' },
  { en: 'Bolivia', pt: 'Bolívia' },
  { en: 'Brazil', pt: 'Brasil' },
  { en: 'Burundi', pt: 'Burundi' },
  { en: 'Cameroon', pt: 'Camarões' },
  { en: 'Cape Verde', pt: 'Cabo Verde' },
  { en: 'China', pt: 'China' },
  { en: 'Colombia', pt: 'Colômbia' },
  { en: 'Congo (DRC)', pt: 'Congo (RDC)' },
  { en: 'Costa Rica', pt: 'Costa Rica' },
  { en: 'Cuba', pt: 'Cuba' },
  { en: 'Dominican Republic', pt: 'República Dominicana' },
  { en: 'Ecuador', pt: 'Equador' },
  { en: 'El Salvador', pt: 'El Salvador' },
  { en: 'Ethiopia', pt: 'Etiópia' },
  { en: 'Guatemala', pt: 'Guatemala' },
  { en: 'Haiti', pt: 'Haiti' },
  { en: 'Hawaii', pt: 'Havai' },
  { en: 'Honduras', pt: 'Honduras' },
  { en: 'India', pt: 'Índia' },
  { en: 'Indonesia', pt: 'Indonésia' },
  { en: 'Jamaica', pt: 'Jamaica' },
  { en: 'Kenya', pt: 'Quénia' },
  { en: 'Laos', pt: 'Laos' },
  { en: 'Malawi', pt: 'Malawi' },
  { en: 'Mexico', pt: 'México' },
  { en: 'Myanmar', pt: 'Myanmar' },
  { en: 'Nepal', pt: 'Nepal' },
  { en: 'Nicaragua', pt: 'Nicarágua' },
  { en: 'Panama', pt: 'Panamá' },
  { en: 'Papua New Guinea', pt: 'Papua-Nova Guiné' },
  { en: 'Peru', pt: 'Peru' },
  { en: 'Philippines', pt: 'Filipinas' },
  { en: 'Rwanda', pt: 'Ruanda' },
  { en: 'São Tomé and Príncipe', pt: 'São Tomé e Príncipe' },
  { en: 'Taiwan', pt: 'Taiwan' },
  { en: 'Tanzania', pt: 'Tanzânia' },
  { en: 'Thailand', pt: 'Tailândia' },
  { en: 'Timor-Leste', pt: 'Timor-Leste' },
  { en: 'Uganda', pt: 'Uganda' },
  { en: 'Venezuela', pt: 'Venezuela' },
  { en: 'Vietnam', pt: 'Vietname' },
  { en: 'Yemen', pt: 'Iémen' },
  { en: 'Zambia', pt: 'Zâmbia' },
  { en: 'Zimbabwe', pt: 'Zimbabwe' },
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
