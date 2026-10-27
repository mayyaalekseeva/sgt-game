import { coffeeName } from '../coffees'
import { localDay } from '../data'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Card, Display, Label, ScreenTitle, brewLabel, fmtDate, fmtNum, fmtTime } from '../ui'

// The brews marked as working recipes, one per recipe. Opened from Profile.
export default function SavedRecipes() {
  const { t, lang } = useStore()
  const data = useReports()
  // one per recipe and coffee, newest first
  const saved = !data.loading
    ? Object.values(data.working)
        .map((id) => data.reports.find((x) => x.id === id))
        .filter((r) => r !== undefined)
        .sort((a, b) => b.ts - a.ts)
    : []

  return (
    <div className="flex flex-col gap-4 lg:max-w-3xl">
      <ScreenTitle title={t('saved.title')} sub={t('saved.sub')} />
      {data.loading ? (
        <p className="text-sm text-ink/70" role="status">{t('loading')}</p>
      ) : saved.length === 0 ? (
        <p className="text-sm text-ink/70">{t('orders.noWorking')}</p>
      ) : (
        <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
          {saved.map((r) => (
            <li key={r.id}>
              <Card className="lg:h-full">
                <Label>
                  {brewLabel(t, r)}
                  {coffeeName(r.lot, data.coffees) && ` · ${coffeeName(r.lot, data.coffees)}`}
                </Label>
                <Display className="mt-1 text-[26px] !normal-case tracking-wide">
                  {fmtNum(r.dose)} g → {fmtNum(r.yield)} g · {fmtTime(r.time, r.method)}
                </Display>
                <p className="mt-1 text-sm text-muted">{t('saved.from', { date: fmtDate(localDay(r.ts), lang) })}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
