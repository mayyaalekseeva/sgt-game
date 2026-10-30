import { useEffect, useState } from 'react'
import { MAX_GRINDER, MAX_NOTES, REPORT_XP, RECIPES, STYLE_OF, TASTES, type Report, type Taste } from '../data'
import { diagnose, diagnoseFilter, timeState, type DiagId } from '../diagnose'
import type { Key } from '../i18n'
import { coffeeName, forRoast } from '../coffees'
import { usePick, useReports } from '../reports'
import { useStore } from '../store'
import { Button, Card, Chevrons, Display, Label, RowButton, Stepper, brewLabel, diagVars, field, fmtNum, fmtRange, fmtTime, signed } from '../ui'
import PhotoControl, { PhotoPicker, SignInForPhotos } from './PhotoControl'
import RecipePicker from './RecipePicker'

export default function Diagnose({
  openDiary,
  openTimer,
  addCoffee,
}: {
  openDiary: () => void
  openTimer: () => void
  addCoffee: () => void
}) {
  const { t, method, timed, takeTimed } = useStore()
  const { rank, addReport, markWorking, working, reports, coffees, signedIn } = useReports()
  const { brew, slug, lot, mine, key } = usePick()
  const recipe = forRoast(RECIPES[slug], mine?.roast)
  const mid = Math.round((recipe.time[0] + recipe.time[1]) / 2)
  // your working recipe for this coffee comes first: start from its dose and yield
  const workingReport = reports.find((x) => x.id === working[key])
  const start = workingReport ?? recipe

  const [dose, setDose] = useState(start.dose)
  const [yld, setYld] = useState(start.yield)
  const [time, setTime] = useState(mid)
  const [taste, setTaste] = useState<Taste | null>(null)
  const [bloomed, setBloomed] = useState(true)
  const [grinder, setGrinder] = useState(workingReport?.grinder ?? '')
  const [notes, setNotes] = useState('')
  const [fromTimer, setFromTimer] = useState(false)
  const [photo, setPhoto] = useState<Blob | null>(null) // prepared, uploaded once the report is filed
  const [result, setResult] = useState<{ report: Report; diag: DiagId; photo: Blob | null } | null>(null)

  // when the recipe or coffee changes, reset the form to its starting point
  useEffect(() => {
    setDose(start.dose)
    setYld(start.yield)
    setTime(mid)
    setTaste(null)
    setBloomed(true)
    setGrinder(workingReport?.grinder ?? '')
    setNotes('')
    setFromTimer(false)
    setPhoto(null)
    setResult(null)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // a brew just finished on the timer: take its time (after the reset above, which also runs on mount)
  useEffect(() => {
    if (!timed) return
    if (timed.slug === slug) {
      setTime(timed.time)
      setBloomed(true)
      setFromTimer(true)
      setResult(null)
    }
    takeTimed()
  }, [timed]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFilter = method === 'filter'
  const style = brew.brewer ? STYLE_OF[brew.brewer] : null
  const file = () => {
    if (!taste) return
    const input = { dose, yield: yld, time, taste, bloomed }
    const diag = style ? diagnoseFilter(style, recipe, input) : diagnose(recipe, input)
    const report = addReport({
      ...brew,
      lot,
      dose,
      yield: yld,
      time,
      taste,
      diag,
      recipeVersionId: recipe.id,
      ...(grinder.trim() ? { grinder: grinder.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(fromTimer ? { timed: true as const } : {}),
    })
    setResult({ report, diag, photo: signedIn ? photo : null })
    setPhoto(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (result) {
    const d = result.diag
    const ts = timeState(recipe, result.report.time)
    const wr = reports.find((x) => x.id === working[key] && x.id !== result.report.id)
    const isWorking = working[key] === result.report.id
    // the list has the photo once it is uploaded
    const filed = reports.find((x) => x.id === result.report.id) ?? result.report
    const k = (s: string) => `d.${d}.${s}` as Key
    return (
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <Card className="flex animate-enter items-center justify-between gap-3">
            <div>
              <Label>
                {t('diag.yourBrew')}
                {coffeeName(result.report.lot, coffees) && ` · ${coffeeName(result.report.lot, coffees)}`}
              </Label>
              <Display className="mt-1 text-[24px] !normal-case tracking-wide">
                {fmtNum(result.report.dose)} g → {fmtNum(result.report.yield)} g · {fmtTime(result.report.time, method)}
              </Display>
            </div>
            <span className="whitespace-nowrap rounded-full border-2 border-terracotta px-3 py-1 text-sm font-semibold text-terracotta">
              {t(`time.${ts}`)}
            </span>
          </Card>

          <div className="animate-stamp rounded-2xl border-2 border-ink bg-olive p-4 text-cream [animation-delay:120ms] lg:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-cream text-olive">
                <Chevrons n={rank.idx + 1} size={18} />
              </div>
              <Display className="text-base tracking-[0.14em]">{t('diag.debrief')}</Display>
            </div>
            <Display className="mt-3 text-[34px] tracking-wide lg:text-[44px]">{t(k('title'))}</Display>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-cream/80">{t('diag.oneChange')}</div>
            <p className="mt-1 text-xl font-semibold leading-snug">{t(k('change'), diagVars(recipe, method))}</p>
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

          {signedIn && <PhotoControl report={filed} initial={result.photo} />}

          <div className="flex animate-pop items-center gap-2 text-sm font-semibold [animation-delay:450ms]">
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
        <RecipePicker addCoffee={addCoffee} />
        {style && <Button variant="secondary" onClick={openTimer}>{t('timer.open')}</Button>}

        <Card className="!py-2">
          <Stepper label={t('recipe.dose')} value={dose} step={0.5} min={5} max={40} display={`${fmtNum(dose)} g`} onChange={setDose} />
          <Stepper label={t(isFilter ? 'recipe.water' : 'recipe.yield')} value={yld} step={isFilter ? 5 : 1} min={10} max={500} display={`${fmtNum(yld)} g`} onChange={setYld} />
          <Stepper label={t('recipe.time')} value={time} step={isFilter ? 5 : 1} min={5} max={600} display={fmtTime(time, method)} onChange={(v) => {
              setTime(v)
              setFromTimer(false)
            }} />
          <div className="py-2 text-xs text-muted">{t('diag.target', { range: fmtRange(recipe.time, method) })}{fromTimer && ` ${t('diag.fromTimer')}`}</div>
          {style === 'pour' && (
            <label className="flex min-h-11 items-center gap-3 border-t border-line py-2 text-[15px] font-semibold">
              <input type="checkbox" checked={bloomed} onChange={(e) => setBloomed(e.target.checked)} className="h-5 w-5 accent-olive" />
              {t('diag.bloomed')}
            </label>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <Label>{t('diag.grinder')}</Label>
            <input
              value={grinder}
              maxLength={MAX_GRINDER}
              placeholder={t('diag.grinderHint')}
              onChange={(e) => setGrinder(e.target.value)}
              className={`h-11 ${field} font-semibold placeholder:font-normal`}
            />
          </label>
          <label className="flex flex-col gap-2">
            <Label>{t('diag.notes')}</Label>
            <textarea
              value={notes}
              maxLength={MAX_NOTES}
              rows={2}
              placeholder={t('diag.notesHint')}
              onChange={(e) => setNotes(e.target.value)}
              className={`${field} resize-none py-2`}
            />
          </label>
          <div className="border-t border-line pt-4">
            {signedIn ? <PhotoPicker value={photo} onChange={setPhoto} /> : <SignInForPhotos />}
          </div>
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
                className={`h-14 rounded-xl border-2 border-ink text-[17px] font-semibold transition-colors duration-150 active:scale-[0.98] ${taste === x ? 'bg-ink text-cream' : 'bg-cream text-ink'}`}
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
                  <span className="font-semibold">{brewLabel(t, r)}</span>
                  <span className="text-muted">
                    {fmtNum(r.dose)}→{fmtNum(r.yield)} g · {fmtTime(r.time, r.method)} · {t(`taste.${r.taste}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Card className="mt-2 !py-1">
            <RowButton label={t('diary.open')} onClick={openDiary} />
          </Card>
        </div>
      </div>
    </div>
  )
}
