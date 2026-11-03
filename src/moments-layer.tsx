import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { Key } from './i18n'
import { MOMENT_MS, fresh, momentsFor, parseCelebrated, showMoments, type Moment } from './moments'
import type { Progress } from './progress'
import { useStore } from './store'
import { Chevrons, Display } from './ui'

// Celebrated event ids, per account ('guest' for this browser's guest), so a reload or a sync never replays one
const storageKey = (owner: string) => `barista-game:celebrated:${owner}`

function readCelebrated(owner: string) {
  try {
    return parseCelebrated(JSON.parse(localStorage.getItem(storageKey(owner)) ?? '[]'))
  } catch {
    return []
  }
}

function writeCelebrated(owner: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify(ids))
  } catch {
    /* storage unavailable: celebrated for this tab only */
  }
}

interface Moments {
  queue: Moment[]
  // After the player's own action on this device (reports.tsx); never called for a sync
  celebrate: (owner: string, before: Progress, after: Progress) => void
  // One moment, or the whole queue
  dismiss: (id?: string) => void
}

const Ctx = createContext<Moments | null>(null)

export function MomentsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Moment[]>([])

  const celebrate = useCallback((owner: string, before: Progress, after: Progress) => {
    const seen = readCelebrated(owner)
    const add = fresh(momentsFor(before, after), seen)
    if (add.length === 0) return
    // remembered as soon as it is queued: one that waits out a brew timer still plays only once
    writeCelebrated(owner, [...seen, ...add.map((m) => m.id)])
    setQueue((q) => [...q, ...add])
  }, [])

  const dismiss = useCallback((id?: string) => setQueue((q) => (id ? q.filter((m) => m.id !== id) : [])), [])

  const value = useMemo(() => ({ queue, celebrate, dismiss }), [queue, celebrate, dismiss])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMoments() {
  const v = useContext(Ctx)
  if (!v) throw new Error('MomentsProvider missing')
  return v
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Counts from 0 up to `to` after `delay`; with reduced motion, the final number straight away
function useCountUp(to: number, ms: number, delay: number) {
  const [n, setN] = useState(() => (reducedMotion() ? to : 0))
  useEffect(() => {
    if (reducedMotion()) return
    let raf = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / ms))
      setN(Math.round(to * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, delay])
  return n
}

function MissionXp({ xp }: { xp: number }) {
  const { t } = useStore()
  const n = useCountUp(xp, 900, 350)
  return <Display className="text-[22px] tabular-nums tracking-wide">{t('moment.xp', { xp: n })}</Display>
}

// What a screen reader hears; the card itself is hidden from it, so nothing is read twice
function announce(t: ReturnType<typeof useStore>['t'], m: Moment) {
  switch (m.kind) {
    case 'rank':
      return `${t('diag.rankUp', { rank: t(`rank.${m.rank}`) })}. ${t(`moment.order.${m.rank}` as Key)} ${t('brief.who.t')}.`
    case 'drill':
      return `${t('moment.drill', { d: t(`drill.${m.drill}.t` as Key) })}. ${t('moment.approved')}.`
    case 'mission':
      return `${t('diag.missionDone', { m: t(`m.${m.mission}.t` as Key) })}. ${t('moment.xp', { xp: m.xp })}.`
  }
}

function Body({ m }: { m: Moment }) {
  const { t } = useStore()
  switch (m.kind) {
    case 'rank':
      return (
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-cream text-olive">
            <Chevrons n={m.idx + 1} size={28} press />
          </div>
          <div className="min-w-0 flex-1">
            <Display className="text-[26px] tracking-wide">{t('diag.rankUp', { rank: t(`rank.${m.rank}`) })}</Display>
            <p className="mt-1 text-[15px] leading-snug">{t(`moment.order.${m.rank}` as Key)}</p>
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
              <img src="./brand/logo.png" alt="" className="h-6 w-6 rounded-full bg-cream object-contain p-0.5" />
              {t('brief.who.t')}
            </div>
          </div>
        </div>
      )
    case 'drill':
      return (
        <div className="flex items-center gap-3">
          <Display className="min-w-0 flex-1 text-[20px] tracking-wide">{t('moment.drill', { d: t(`drill.${m.drill}.t` as Key) })}</Display>
          <div className="flex-none -rotate-12">
            <div className="animate-stamp rounded-md border-4 border-terracotta bg-cream px-2 py-1 font-display text-[22px] font-extrabold uppercase tracking-[0.12em] text-terracotta [animation-delay:250ms]">
              {t('moment.approved')}
            </div>
          </div>
        </div>
      )
    case 'mission':
      return (
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-olive text-cream">
              <Chevrons n={1} size={14} />
            </span>
            <Display className="min-w-0 flex-1 text-[20px] tracking-wide">{t('diag.missionDone', { m: t(`m.${m.mission}.t` as Key) })}</Display>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded bg-line">
              <div
                className="h-2 w-full origin-left animate-fill rounded bg-olive-soft [animation-delay:200ms]"
                style={{ '--fill-from': m.from } as CSSProperties}
              />
            </div>
            <MissionXp xp={m.xp} />
          </div>
        </div>
      )
  }
}

// Above the bottom tabs, over the screen without covering it: only the card takes taps (one skips it), and it
// never takes focus. It waits while a brew is timed, and shows the next moment in the queue when one ends.
export function MomentLayer({ onTimerScreen }: { onTimerScreen: boolean }) {
  const { t, timer } = useStore()
  const { queue, dismiss } = useMoments()
  const m = showMoments(timer !== null, onTimerScreen) ? queue[0] : undefined

  useEffect(() => {
    if (!m) return
    const id = window.setTimeout(() => dismiss(m.id), MOMENT_MS[m.kind])
    return () => window.clearTimeout(id)
  }, [m, dismiss])

  const dark = m?.kind === 'rank'
  return (
    <>
      {/* mounted before any moment, so each one is read out as it arrives */}
      <div role="status" className="sr-only">
        {m ? announce(t, m) : ''}
      </div>
      {m && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 lg:bottom-6">
          <div
            key={m.id}
            onClick={() => dismiss(m.id)}
            className={`pointer-events-auto flex w-full max-w-[448px] animate-enter items-start gap-1 rounded-2xl border-2 border-ink py-3 pl-4 pr-1 ${dark ? 'bg-olive text-cream' : 'bg-cream text-ink'}`}
          >
            <div aria-hidden="true" className="min-w-0 flex-1 py-1">
              <Body m={m} />
            </div>
            <button
              type="button"
              aria-label={t('moment.close')}
              onClick={(e) => {
                e.stopPropagation()
                dismiss()
              }}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}
