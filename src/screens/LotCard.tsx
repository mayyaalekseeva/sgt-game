import { lotBySlug } from '../lots'
import { useStore } from '../store'
import { Card, Display, Label } from '../ui'

// The picked coffee: where it is from and how it tastes. The recipe is still the brewer's (or roast's)
// starting point until the roaster gives one per lot.
export default function LotCard() {
  const { t, lang, lot: slug } = useStore()
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
