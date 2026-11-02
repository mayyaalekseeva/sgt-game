import { RANKS, RECIPES } from '../data'
import { forRoast } from '../coffees'
import { grinderText } from '../grinders'
import type { Key } from '../i18n'
import { usePick, useReports } from '../reports'
import { useStore } from '../store'
import { Card, Display, Label, Button, RowButton, Stat, fmtNum, fmtRange, fmtTime, ratio } from '../ui'
import RankCard from './RankCard'
import LotCard from './LotCard'
import RecipePicker from './RecipePicker'
import RecipeSteps from './RecipeSteps'

export default function Orders({
  go,
  openTimer,
  openRecipes,
  openLots,
  openDrill,
  addCoffee,
}: {
  go: () => void
  openTimer: () => void
  openRecipes: () => void
  openLots: () => void
  openDrill: (id: string) => void
  addCoffee: () => void
}) {
  const { t, method } = useStore()
  const isFilter = method === 'filter'
  const { reports, working, drills } = useReports()
  // the first drill not yet done: its field test, or its field assignment
  const drill = drills.find((d) => d.unlocked && !d.done)
  const { brew, slug, mine, key } = usePick()
  const r = forRoast(RECIPES[slug], mine?.roast)
  const tip = Math.floor(Date.now() / 86400000) % 5
  const workingReport = reports.find((x) => x.id === working[key])

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <RankCard />

        <div className="rounded-2xl border-2 border-ink bg-olive p-4 text-cream">
          <div className="flex items-center gap-3">
            <img src="./brand/sargento.jpg" alt="" className="h-12 w-12 flex-none rounded-full border-2 border-cream object-cover" />
            <Display className="text-lg tracking-[0.14em] text-cream">{t('orders.title')}</Display>
          </div>
          <p className="mt-3 text-[21px] font-medium leading-snug lg:text-[26px]">{t(`tip.${tip as 0 | 1 | 2 | 3 | 4}`)}</p>
          {drill && (
            <button
              type="button"
              onClick={() => openDrill(drill.id)}
              className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-xl border-2 border-ink bg-cream px-4 py-2 text-left text-ink active:scale-[0.98]"
            >
              <span className="flex-1 text-[16px] font-semibold leading-snug">{t('drills.next', { d: t(`drill.${drill.id}.t` as Key) })}</span>
              <span aria-hidden="true" className="text-xl">›</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>{t('orders.recipe')}</Label>
          <RecipePicker addCoffee={addCoffee} coffee={<LotCard openLots={openLots} />} />
        </div>

        {/* sibling keys must differ: a shared key makes React leave stale copies behind on brewer change */}
        <div key={`stats-${key}`} className="grid animate-enter grid-cols-2 gap-3">
          <Stat label={t('recipe.dose')} value={`${fmtNum(r.dose)} g`} />
          <Stat label={t(brew.brewer ? 'recipe.water' : 'recipe.yield')} value={`${fmtNum(r.yield)} g`} />
          <Stat label={t('recipe.time')} value={fmtRange(r.time, method)} compact={isFilter} />
          <Stat label={t(brew.brewer ? 'recipe.temperature' : 'recipe.temp')} value={`${r.temp[0]}–${r.temp[1]} °C`} />
        </div>
        {brew.brewer && (
          <Card key={`steps-${key}`} className="animate-enter">
            <RecipeSteps recipe={r} brewer={brew.brewer} />
          </Card>
        )}
        <p className="text-sm leading-snug text-ink/80">
          {t('orders.ratio', { r: ratio(r) })}. {t('orders.note')}
        </p>
        <Card className="!py-1">
          <RowButton label={t('orders.allRecipes')} onClick={openRecipes} />
        </Card>

        <Card>
          <Label>{t('orders.working')}</Label>
          {workingReport ? (
            <Display className="mt-1 text-[26px] !normal-case tracking-wide">
              {fmtNum(workingReport.dose)} g → {fmtNum(workingReport.yield)} g · {fmtTime(workingReport.time, workingReport.method)}
            </Display>
          ) : (
            <p className="mt-1 text-sm text-muted">{t('orders.noWorking')}</p>
          )}
          {workingReport && grinderText(workingReport) && <p className="mt-1 text-[15px] font-semibold">{t('saved.grinder', { g: grinderText(workingReport) })}</p>}
          {workingReport?.notes && <p className="mt-1 text-[15px] leading-snug">{workingReport.notes}</p>}
        </Card>

        {isFilter && <Button onClick={openTimer}>{t('timer.open')}</Button>}
        <Button variant={isFilter ? 'secondary' : 'primary'} onClick={go}>{t('orders.cta')}</Button>
      </div>
      <span className="hidden">{RANKS.length}</span>
    </div>
  )
}
