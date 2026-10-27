import { useEffect, useState } from 'react'
import { REPORT_XP, RECIPES, TASTES, recipeKey, type Report, type Taste } from '../data'
import { diagnose, timeState, type DiagId } from '../diagnose'
import type { Key } from '../i18n'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Button, Card, Chevrons, Display, Label, LinkButton, Stepper, fmtNum, fmtRange, fmtTime } from '../ui'
import RecipePicker from './RecipePicker'

export default function Diagnose({ openDiary }: { openDiary: () => void }) {
  const { t, method, roast } = useStore()
  const { rank, addReport, markWorking, working, reports } = useReports()
  const key = recipeKey(method, roast)
  const recipe = RECIPES[key]
  const mid = Math.round((recipe.time[0] + recipe.time[1]) / 2)

  const [dose, setDose] = useState(recipe.dose)
  const [yld, setYld] = useState(recipe.yield)
  const [time, setTime] = useState(mid)
  const [taste, setTaste] = useState<Taste | null>(null)
  const [result, setResult] = useState<{ report: Report; diag: DiagId } | null>(null)

  // when the recipe selection changes, reset the form to that recipe
  useEffect(() => {
    setDose(recipe.dose)
    setYld(recipe.yield)
    setTime(mid)
    setTaste(null)
    setResult(null)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFilter = method === 'filter'
  const file = () => {
    if (!taste) return
    const diag = diagnose(recipe, { dose, yield: yld, time, taste })
    const report = addReport({ method, roast, dose, yield: yld, time, taste, diag, recipeVersionId: recipe.id })
    setResult({ report, diag })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (result) {
    const d = result.diag
    const ts = timeState(recipe, result.report.time)
    const wr = reports.find((x) => x.id === working[key] && x.id !== result.report.id)
    const isWorking = working[key] === result.report.id
    const k = (s: string) => `d.${d}.${s}` as Key
    return (
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <Card className="flex items-center justify-between gap-3">
            <div>
              <Label>{t('diag.yourBrew')}</Label>
              <Display className="mt-1 text-[24px] !normal-case tracking-wide">
                {fmtNum(result.report.dose)} g → {fmtNum(result.report.yield)} g · {fmtTime(result.report.time, method)}
              </Display>
            </div>
            <span className="whitespace-nowrap rounded-full border-2 border-terracotta px-3 py-1 text-sm font-semibold text-terracotta">
              {t(`time.${ts}`)}
            </span>
          </Card>

          <div className="rounded-2xl border-2 border-ink bg-olive p-4 text-cream lg:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-cream text-olive">
                <Chevrons n={rank.idx + 1} size={18} />
              </div>
              <Display className="text-base tracking-[0.14em]">{t('diag.debrief')}</Display>
            </div>
            <Display className="mt-3 text-[34px] tracking-wide lg:text-[44px]">{t(k('title'))}</Display>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-cream/80">{t('diag.oneChange')}</div>
            <p className="mt-1 text-xl font-semibold leading-snug">{t(k('change'), { y: fmtNum(recipe.yield) })}</p>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-cream/80">{t('diag.why')}</div>
            <p className="mt-1 text-[17px] leading-snug">{t(k('why'))}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {wr && (
            <Card>
              <Label>{t('diag.compare')}</Label>
              <p className="mt-1 text-[15px]">
                {t('diag.compareLine', {
                  d: signed(result.report.dose - wr.dose, ' g'),
                  y: signed(result.report.yield - wr.yield, ' g'),
                  t: signed(result.report.time - wr.time, ' s'),
                })}
              </p>
            </Card>
          )}

          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-olive text-cream">
              <Chevrons n={1} size={12} />
            </span>
            {t('diag.filed', { xp: REPORT_XP })}
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={() => { setResult(null); setTaste(null) }}>{t('diag.again')}</Button>
            <Button
              variant="secondary"
              disabled={isWorking}
              onClick={() => markWorking(key, result.report.id)}
            >
              {isWorking ? t('diag.isWorking') : t('diag.markWorking')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="lg:col-span-2">
        <Display className="text-[40px] tracking-wide">{t('diag.title')}</Display>
        <p className="mt-1 text-[15px] text-ink/80">{t('diag.sub')}</p>
      </div>

      <div className="flex flex-col gap-4">
        <RecipePicker />

        <Card className="!py-2">
          <Stepper label={t('recipe.dose')} value={dose} step={0.5} min={5} max={40} display={`${fmtNum(dose)} g`} onChange={setDose} />
          <Stepper label={t('recipe.yield')} value={yld} step={isFilter ? 5 : 1} min={10} max={500} display={`${fmtNum(yld)} g`} onChange={setYld} />
          <Stepper label={t('recipe.time')} value={time} step={isFilter ? 5 : 1} min={5} max={600} display={fmtTime(time, method)} onChange={setTime} />
          <div className="py-2 text-xs text-muted">{t('diag.target', { range: fmtRange(recipe.time, method) })}</div>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <Label>{t('diag.taste')}</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {TASTES.map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={taste === x}
                onClick={() => setTaste(x)}
                className={`h-14 rounded-xl border-2 border-ink text-[17px] font-semibold ${taste === x ? 'bg-ink text-cream' : 'bg-cream text-ink'}`}
              >
                {t(`taste.${x}`)}
              </button>
            ))}
          </div>
        </div>

        <Button disabled={!taste} onClick={file}>{t('diag.file')}</Button>
        <p className="text-xs text-ink/70">{t('diag.guideline')}</p>

        <div>
          <Label>{t('diag.history')}</Label>
          {reports.length === 0 ? (
            <p className="mt-2 text-sm text-ink/70">{t('diag.noHistory')}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {reports.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-cream px-3 py-2 text-sm">
                  <span className="font-semibold">
                    {t(`method.${r.method}`)} · {t(`roast.${r.roast}`)}
                  </span>
                  <span className="text-muted">
                    {fmtNum(r.dose)}→{fmtNum(r.yield)} g · {fmtTime(r.time, r.method)} · {t(`taste.${r.taste}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <LinkButton onClick={openDiary}>{t('diary.open')}</LinkButton>
        </div>
      </div>
    </div>
  )
}

const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(n))}${unit}`
