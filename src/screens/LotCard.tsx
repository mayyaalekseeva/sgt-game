import { lotBySlug } from '../lots'
import { usePick } from '../reports'
import { useStore } from '../store'
import { Card, Display, Label } from '../ui'

// The picked coffee: where it is from and how it tastes. A roaster lot uses the brewer's (or roast's)
// starting recipe until the roaster gives one per lot; your own coffee shifts it by its roast.
export default function LotCard() {
  const { t, lang } = useStore()
  const { lot: slug, mine } = usePick()
  if (mine) {
    return (
      <Card key={mine.id} className="animate-enter">
        <Label>
          {mine.roaster} · {mine.origin}
        </Label>
        <Display className="mt-1 text-[28px] tracking-wide">{mine.name ?? mine.origin}</Display>
        <p className="mt-1 text-sm text-muted">
          {t(`process.${mine.process}`)} · {t(`roast.${mine.roast}`)}
        </p>
        <p className="mt-2 text-xs text-ink/70">{t('coffee.recipeNote')}</p>
      </Card>
    )
  }
  const lot = lotBySlug(slug)
  if (!lot) return null
  const [lo, hi] = lot.altitude
  return (
    <Card key={lot.slug} className="animate-enter">
      <div className="flex items-baseline justify-between gap-2">
        <Label>
          {lot.country[lang]} · {lot.region}
        </Label>
        <span className="whitespace-nowrap rounded-full border border-ink px-2 py-0.5 text-xs font-semibold">{t(`profile.${lot.profile}`)}</span>
      </div>
      <Display className="mt-1 text-[28px] tracking-wide">{lot.name}</Display>
      <p className="mt-1 text-[17px] font-semibold leading-snug">{lot.notes[lang]}</p>
      <p className="mt-1 text-sm text-muted">
        {lot.process[lang]} · {lot.variety} · {lo === hi ? `${lo} m` : `${lo}–${hi} m`}
      </p>
      <p className="mt-2 text-xs text-ink/70">{t('lot.recipeSoon')}</p>
    </Card>
  )
}
