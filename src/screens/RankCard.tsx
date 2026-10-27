import { useReports } from '../reports'
import { useStore } from '../store'
import { Card, Chevrons, Display } from '../ui'

// Rank, XP and the way to the next rank (Orders and Profile)
export default function RankCard() {
  const { t } = useStore()
  const { rank, xp } = useReports()
  return (
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
  )
}
