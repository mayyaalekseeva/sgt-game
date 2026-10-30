import { useEffect, useState } from 'react'
import { gainsFor, type progressFor } from '../data'
import type { Key } from '../i18n'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Chevrons, Display } from '../ui'

// The debrief's reward: XP gained since filing, a promotion, missions just done.
// Compared with live progress, so marking the working recipe here adds its mission too.
export default function Gains({ before }: { before: ReturnType<typeof progressFor> }) {
  const { t } = useStore()
  const now = useReports()
  const g = gainsFor(before, now)
  const { rank, xp } = now

  // The bar starts where it was and fills once it is on screen; a new rank starts it again from empty
  const [width, setWidth] = useState(g.rankUp ? 0 : before.rank.pct)
  const [shownRank, setShownRank] = useState(rank.idx)
  if (shownRank !== rank.idx) {
    setShownRank(rank.idx)
    setWidth(0)
  }
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(rank.pct))
    return () => cancelAnimationFrame(id)
  }, [rank.pct, rank.idx])

  return (
    <div className="flex flex-col gap-3">
      {g.rankUp && (
        <div className="flex animate-stamp items-center gap-3 rounded-2xl border-2 border-ink bg-olive p-4 text-cream [animation-delay:450ms]">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-cream text-olive">
            <Chevrons n={rank.idx + 1} size={22} />
          </div>
          <Display className="text-[26px] tracking-wide">{t('diag.rankUp', { rank: t(`rank.${g.rankUp}`) })}</Display>
        </div>
      )}

      <div className="animate-enter [animation-delay:300ms]">
        <div className="flex items-baseline justify-between gap-2 text-sm font-semibold">
          <span>{t('diag.filed', { xp: g.xp })}</span>
          <span className="text-muted">{xp} {t('xp')}</span>
        </div>
        <div className="mt-2 h-2 rounded bg-line">
          <div
            key={rank.idx}
            className="h-2 rounded bg-olive-soft transition-[width] delay-500 duration-700 ease-out"
            style={{ width: `${Math.max(width, 4)}%` }}
          />
        </div>
      </div>

      {g.missions.map((id, i) => (
        <div
          key={id}
          className="flex animate-pop items-center gap-2 text-sm font-semibold"
          style={{ animationDelay: `${700 + i * 150}ms` }}
        >
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-olive text-cream">
            <Chevrons n={1} size={12} />
          </span>
          {t('diag.missionDone', { m: t(`m.${id}.t` as Key) })}
        </div>
      ))}
    </div>
  )
}
