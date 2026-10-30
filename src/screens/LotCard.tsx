import { lotBySlug, lotPhoto, type Lot } from '../lots'
import { usePick } from '../reports'
import Freshness from './Freshness'
import { useStore } from '../store'
import { Card, Display, Label, RowButton, processLabel } from '../ui'

// The picked coffee: where it is from and how it tastes. A roaster lot uses the brewer's (or roast's)
// starting recipe until the roaster gives one per lot; your own coffee shifts it by its roast.
export default function LotCard({ openLots }: { openLots: () => void }) {
  const { t, method } = useStore()
  const { lot: slug, mine } = usePick()
  if (mine) {
    return (
      <Card key={mine.id} className="animate-enter">
        <Label>
          {mine.roaster} · {mine.origin}
        </Label>
        <Display className="mt-1 text-[28px] tracking-wide">{mine.name ?? mine.origin}</Display>
        <p className="mt-1 text-sm text-muted">
          {processLabel(t, mine.process)} · {t(`roast.${mine.roast}`)}
        </p>
        <Freshness coffee={mine} method={method} />
        <p className="mt-2 text-xs text-ink/70">{t('coffee.recipeNote')}</p>
      </Card>
    )
  }
  const lot = lotBySlug(slug)
  if (!lot) return null
  return (
    <Card key={lot.slug} className="animate-enter">
      <LotHead lot={lot} />
      <div className="mt-2 flex items-start gap-3">
        <LotPhoto lot={lot} className="h-[72px] w-[72px]" />
        <div className="min-w-0 flex-1 [&>p:first-child]:mt-0">
          <LotTasting lot={lot} />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink/70">{t('lot.recipeSoon')}</p>
      <div className="mt-2 border-t border-line">
        <RowButton label={t('lots.all')} onClick={openLots} />
      </div>
    </Card>
  )
}

// The roaster's bag photo, copied from its shop; nothing for a lot without one
export function LotPhoto({ lot, className = '' }: { lot: Lot; className?: string }) {
  const { t } = useStore()
  const src = lotPhoto(lot)
  if (!src) return null
  return (
    <img
      src={src}
      alt={t('lots.photoAlt', { name: lot.name })}
      loading="lazy"
      className={`flex-none rounded-lg border-2 border-ink bg-line object-cover ${className}`}
    />
  )
}

// Origin and profile, then the name
export function LotHead({ lot }: { lot: Lot }) {
  const { t, lang } = useStore()
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <Label>
          {lot.country[lang]} · {lot.region}
        </Label>
        <span className="whitespace-nowrap rounded-full border border-ink px-2 py-0.5 text-xs font-semibold">{t(`profile.${lot.profile}`)}</span>
      </div>
      <Display className="mt-1 text-[28px] tracking-wide">{lot.name}</Display>
    </>
  )
}

// How it tastes and how it was grown
export function LotTasting({ lot }: { lot: Lot }) {
  const { lang } = useStore()
  const [lo, hi] = lot.altitude
  return (
    <>
      <p className="mt-2 text-[17px] font-semibold leading-snug">{lot.notes[lang]}</p>
      <p className="mt-1 text-sm text-muted">
        {lot.process[lang]} · {lot.variety} · {lo === hi ? `${lo} m` : `${lo}–${hi} m`}
      </p>
    </>
  )
}
