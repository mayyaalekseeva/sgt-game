import { useEffect, useState } from 'react'
import { CHECK_PHASES, ESPRESSO_STEPS, type CheckStep, type Recipe } from '../data'
import { useStore } from '../store'
import { elapsedSeconds } from '../timer'
import { Card, Label, fmtNum, fmtRange, fmtTime } from '../ui'

// One espresso shot step by step. Ticks live here only; remount it (a new key) to start the next brew clean.
// The shot step times the pull and hands the seconds to the form.
export default function EspressoChecklist({
  recipe,
  dose,
  yld,
  grinder,
  onTime,
}: {
  recipe: Recipe
  dose: number
  yld: number
  grinder: string
  onTime: (seconds: number) => void
}) {
  const { t } = useStore()
  const [open, setOpen] = useState(true)
  const [done, setDone] = useState<Set<CheckStep>>(() => new Set())
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now)
  const [pulled, setPulled] = useState(0)

  useEffect(() => {
    if (startedAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [startedAt])

  const tick = (id: CheckStep, on: boolean) =>
    setDone((d) => {
      const next = new Set(d)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const text = (id: CheckStep) => {
    if (id === 'dose') return t('check.dose', { dose: fmtNum(dose) })
    if (id === 'grind') return grinder.trim() ? t('check.grind', { setting: grinder.trim() }) : t('check.grindFine')
    if (id === 'pull') return t('check.pull', { yield: fmtNum(yld), range: fmtRange(recipe.time, 'espresso') })
    return t(`check.${id}`)
  }

  // a stopped shot keeps its time on the clock until the next start
  const elapsed = startedAt === null ? pulled : elapsedSeconds(startedAt, now)
  const startStop = () => {
    if (startedAt === null) {
      setNow(Date.now())
      setStartedAt(Date.now())
      return
    }
    setPulled(elapsed)
    onTime(elapsed)
    tick('pull', true)
    setStartedAt(null)
  }

  return (
    <Card className="!py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[15px] font-semibold">
          {t('check.title')}
          <span className="ml-2 font-normal text-muted tabular-nums">
            {done.size}/{ESPRESSO_STEPS.length}
          </span>
        </span>
        <span className="text-sm text-muted underline">{t(open ? 'check.hide' : 'check.show')}</span>
      </button>

      {open &&
        CHECK_PHASES.map((phase) => (
          <div key={phase} className="border-t border-line pt-2">
            <Label>{t(`check.phase.${phase}`)}</Label>
            <ul>
              {ESPRESSO_STEPS.filter((s) => s.phase === phase).map(({ id }) => (
                <li key={id}>
                  <label className={`flex min-h-11 items-center gap-3 py-1 text-[15px] ${done.has(id) ? 'text-ink/50 line-through' : ''}`}>
                    <input type="checkbox" checked={done.has(id)} onChange={(e) => tick(id, e.target.checked)} className="h-5 w-5 flex-none accent-olive" />
                    {text(id)}
                  </label>
                  {id === 'pull' && (
                    <div className="flex items-center justify-between gap-3 pb-2 pl-8">
                      <span className="font-display text-[32px] font-extrabold leading-none tabular-nums" aria-live="off">
                        {fmtTime(elapsed, 'espresso')}
                      </span>
                      <button
                        type="button"
                        onClick={startStop}
                        className={`flex h-11 items-center rounded-lg px-4 text-[15px] font-semibold active:scale-[0.98] ${startedAt === null ? 'bg-olive text-cream' : 'bg-ink text-cream'}`}
                      >
                        {t(startedAt === null ? 'check.start' : 'check.stop')}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </Card>
  )
}
