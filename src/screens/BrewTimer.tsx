import { useEffect, useState } from 'react'
import { RECIPES, RECIPE_CONTENT, STYLE_OF } from '../data'
import { timeState } from '../diagnose'
import { useStore } from '../store'
import { elapsedSeconds, timerState } from '../timer'
import { Button, Card, Display, Label, ScreenTitle, brewLabel, fmtNum, fmtRange, fmtTime } from '../ui'
import RecipeSteps from './RecipeSteps'

// Calls each step of a filter recipe as it comes. Done hands the time to Diagnose.
export default function BrewTimer({ done }: { done: () => void }) {
  const { t, slug: picked, timer, startTimer, cancelTimer, finishTimer } = useStore()
  // a running brew keeps its recipe even if the picker changes on another tab
  const slug = timer?.slug ?? picked
  const entry = RECIPE_CONTENT.find((e) => e.slug === slug)
  const recipe = RECIPES[slug]
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!timer) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [timer])

  // keep the phone awake while brewing; not every browser supports it
  useEffect(() => {
    if (!timer || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => {
      lock?.release().catch(() => {})
    }
  }, [timer])

  const steps = recipe?.steps ?? []
  const elapsed = timer ? elapsedSeconds(timer.startedAt, now) : 0
  const state = timerState(steps, elapsed)

  // a short buzz on each new step, where the device can
  useEffect(() => {
    if (timer && state.current > 0) navigator.vibrate?.(200)
  }, [timer, state.current])

  if (!entry?.brewer || !recipe?.steps) {
    return (
      <div className="flex flex-col gap-4 lg:max-w-xl">
        <ScreenTitle title={t('timer.title')} sub={t('timer.filterOnly')} />
        <Button variant="secondary" onClick={done}>{t('tab.diag')}</Button>
      </div>
    )
  }

  const style = STYLE_OF[entry.brewer]
  const cur = state.current >= 0 ? steps[state.current] : null
  const next = state.next !== null ? steps[state.next] : null
  const stepText = (i: number) => t(`step.${steps[i].kind}`, { to: steps[i].to ?? 0 })

  if (!timer) {
    return (
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="lg:col-span-2">
          <ScreenTitle title={t('timer.title')} sub={t('timer.sub')} />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <Label>{brewLabel(t, entry)}</Label>
            <Display className="mt-1 text-[28px] !normal-case tracking-wide">
              {fmtNum(recipe.dose)} g → {fmtNum(recipe.yield)} g · {recipe.temp[0]}–{recipe.temp[1]} °C
            </Display>
          </Card>
          <Button onClick={() => startTimer(slug)}>{t('timer.start')}</Button>
        </div>
        <Card>
          <RecipeSteps recipe={recipe} brewer={entry.brewer} />
        </Card>
      </div>
    )
  }

  const window_ = state.next === null ? timeState(recipe, elapsed) : null

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <Card className="flex items-center justify-between gap-3">
          <div>
            <Label>{brewLabel(t, entry)}</Label>
            <Display className="mt-1 text-[88px] leading-none tabular-nums" aria-live="off">
              {fmtTime(elapsed, 'filter')}
            </Display>
          </div>
          {window_ && (
            <span className="whitespace-nowrap rounded-full border-2 border-terracotta px-3 py-1 text-sm font-semibold text-terracotta">
              {t(`time.${window_}`)}
            </span>
          )}
        </Card>

        <div className="rounded-2xl border-2 border-ink bg-olive p-4 text-cream lg:p-6" aria-live="polite">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-cream/80">{t('timer.now')}</div>
          {/* keyed by step: each new step slides in */}
          <p key={state.current} className="mt-1 animate-step text-[26px] font-semibold leading-snug">{cur ? stepText(state.current) : t('timer.ready')}</p>
          {/* the last three seconds before a step pulse once each */}
          <div
            key={next && state.toNext <= 3 ? state.toNext : 'next'}
            className={`mt-3 text-xs font-semibold uppercase tracking-[0.12em] ${next && state.toNext <= 3 ? 'animate-pop text-cream' : 'text-cream/80'}`}
          >
            {next ? t('timer.next', { at: fmtTime(next.at, 'filter'), n: state.toNext }) : t('timer.last')}
          </div>
          <p className="mt-1 text-[17px] leading-snug">
            {state.next !== null ? stepText(state.next) : t(`step.end.${style}`, { range: fmtRange(recipe.time, 'filter') })}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              finishTimer(elapsed)
              done()
            }}
          >
            {t('timer.finish')}
          </Button>
          <p className="text-xs text-ink/70">{t(`timer.finishHint.${style}`)}</p>
          <Button variant="ghost" onClick={cancelTimer}>{t('timer.cancel')}</Button>
        </div>
      </div>

      <Card className="!py-1">
        <ol>
          {steps.map((s, i) => (
            <li
              key={i}
              aria-current={i === state.current ? 'step' : undefined}
              className={`flex gap-3 border-b border-line py-2 text-[15px] last:border-b-0 ${i < state.current ? 'text-ink/50 line-through' : ''} ${i === state.current ? 'font-semibold' : ''}`}
            >
              <span className="w-12 flex-none tabular-nums">{fmtTime(s.at, 'filter')}</span>
              <span>{stepText(i)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
