import { freshness, type MyCoffee } from '../coffees'
import { localDay, type Method } from '../data'
import { useStore } from '../store'

// How old your bag is, and what that means for this method. Nothing without a roast date.
export default function Freshness({ coffee, method }: { coffee: MyCoffee; method: Method }) {
  const { t } = useStore()
  const f = freshness(coffee.roastedOn, localDay(Date.now()), method)
  if (!f) return null
  const warn = f.stage !== 'peak'
  return (
    <div className="mt-2">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span>{f.days === 0 ? t('fresh.today') : t('fresh.days', { n: f.days })}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${warn ? 'border-2 border-terracotta text-terracotta' : 'bg-olive text-cream'}`}>
          {t(`fresh.${f.stage}`)}
        </span>
      </p>
      {warn && <p className="mt-1 text-sm leading-snug text-ink/80">{t(`fresh.${f.stage}.hint`)}</p>}
    </div>
  )
}
