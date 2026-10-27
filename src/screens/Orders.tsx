import { RANKS, RECIPES, recipeKey } from '../data'
import { useStore } from '../store'
import { Card, Chevrons, Display, Label, LinkButton, Button, Stat, fmtNum, fmtRange, fmtTime, ratio } from '../ui'
import RecipePicker from './RecipePicker'

export default function Orders({ go, openRecipes }: { go: () => void; openRecipes: () => void }) {
  const { t, rank, xp, method, roast, reports, working } = useStore()
  const key = recipeKey(method, roast)
  const r = RECIPES[key]
  const tip = Math.floor(Date.now() / 86400000) % 5
  const workingReport = reports.find((x) => x.id === working[key])

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <Card className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-olive text-cream">
            <Chevrons n={rank.idx + 1} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <Display className="text-2xl tracking-wider">{t(`rank.${rank.cur.id}`)}</Display>
              <div className="text-sm text-muted">{xp} {t('xp')}</div>
            </div>
            <div className="mt-2 h-2 rounded bg-line">
              <div className="h-2 rounded bg-olive-soft transition-all" style={{ width: `${Math.max(rank.pct, 4)}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted">
              {rank.next ? t('rank.toNext', { xp: rank.next.xp - xp, rank: t(`rank.${rank.next.id}`) }) : t('rank.max')}
            </div>
          </div>
        </Card>

        <div className="rounded-2xl border-2 border-ink bg-olive p-4 text-cream">
          <div className="flex items-center gap-3">
            <img src="./brand/sargento.jpg" alt="" className="h-12 w-12 flex-none rounded-full border-2 border-cream object-cover" />
            <Display className="text-lg tracking-[0.14em] text-cream">{t('orders.title')}</Display>
          </div>
          <p className="mt-3 text-[21px] font-medium leading-snug lg:text-[26px]">{t(`tip.${tip as 0 | 1 | 2 | 3 | 4}`)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>{t('orders.recipe')}</Label>
          <RecipePicker />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label={t('recipe.dose')} value={`${fmtNum(r.dose)} g`} />
          <Stat label={t('recipe.yield')} value={`${fmtNum(r.yield)} g`} />
          <Stat label={t('recipe.time')} value={fmtRange(r.time, method)} />
          <Stat label={t('recipe.temp')} value={`${r.temp[0]}–${r.temp[1]} °C`} />
        </div>
        <div>
          <p className="text-sm leading-snug text-ink/80">
            {t('orders.ratio', { r: ratio(r) })}. {t('orders.note')}
          </p>
          <LinkButton onClick={openRecipes}>{t('orders.allRecipes')}</LinkButton>
        </div>

        <Card>
          <Label>{t('orders.working')}</Label>
          {workingReport ? (
            <Display className="mt-1 text-[26px] !normal-case tracking-wide">
              {fmtNum(workingReport.dose)} g → {fmtNum(workingReport.yield)} g · {fmtTime(workingReport.time, workingReport.method)}
            </Display>
          ) : (
            <p className="mt-1 text-sm text-muted">{t('orders.noWorking')}</p>
          )}
        </Card>

        <Button onClick={go}>{t('orders.cta')}</Button>
      </div>
      <span className="hidden">{RANKS.length}</span>
    </div>
  )
}
