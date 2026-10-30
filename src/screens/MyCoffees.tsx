import { myRef, type MyCoffee } from '../coffees'
import { useReports } from '../reports'
import { localDay } from '../data'
import { useStore } from '../store'
import Freshness from './Freshness'
import { Button, Card, Display, Label, ScreenTitle, SmallButton, field, processLabel } from '../ui'

// Your own coffees, opened from Profile. A finished bag leaves the picker but keeps its name in the diary.
export default function MyCoffees({ add }: { add: () => void }) {
  const { t, method } = useStore()
  const { coffees, saveCoffee, reports } = useReports()
  const open = coffees.filter((c) => !c.archived)
  const finished = coffees.filter((c) => c.archived)
  const brews = (c: MyCoffee) => reports.filter((r) => r.lot === myRef(c.id)).length
  const toggle = (c: MyCoffee) => saveCoffee({ ...c, archived: !c.archived || undefined, updatedAt: Date.now() })
  // a new bag of the same coffee: just a new roast date
  const setRoastedOn = (c: MyCoffee, day: string) => {
    const { roastedOn: _, ...rest } = c
    saveCoffee({ ...rest, ...(day ? { roastedOn: day } : {}), updatedAt: Date.now() })
  }

  const row = (c: MyCoffee) => (
    <li key={c.id}>
      <Card className={c.archived ? 'opacity-70' : ''}>
        <Label>
          {c.roaster} · {c.origin}
        </Label>
        <Display className="mt-1 text-[26px] tracking-wide">{c.name ?? c.origin}</Display>
        <p className="mt-1 text-sm text-muted">
          {processLabel(t, c.process)} · {t(`roast.${c.roast}`)} · {t('coffee.brews', { n: brews(c) })}
        </p>
        {!c.archived && <Freshness coffee={c} method={method} />}
        {!c.archived && (
          <label className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold">
            {t('coffee.roastedOnShort')}
            <input
              type="date"
              value={c.roastedOn ?? ''}
              max={localDay(Date.now())}
              onChange={(e) => setRoastedOn(c, e.target.value)}
              className={`h-11 ${field}`}
            />
          </label>
        )}
        <SmallButton onClick={() => toggle(c)}>{t(c.archived ? 'coffee.restore' : 'coffee.finish')}</SmallButton>
      </Card>
    </li>
  )

  return (
    <div className="flex flex-col gap-4 lg:max-w-3xl">
      <ScreenTitle title={t('coffee.mine')} sub={t('coffee.mineSub')} />
      {open.length === 0 && <p className="text-sm text-ink/70">{t('coffee.none')}</p>}
      <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">{open.map(row)}</ul>
      <Button onClick={add}>{t('coffee.add')}</Button>
      {finished.length > 0 && (
        <>
          <Label>{t('coffee.finished')}</Label>
          <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">{finished.map(row)}</ul>
        </>
      )}
    </div>
  )
}
