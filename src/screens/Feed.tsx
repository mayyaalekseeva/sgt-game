import { useState } from 'react'
import { photoUrl } from '../api'
import { SIGN_IN_URL } from '../auth'
import { coffeeName } from '../coffees'
import { feedReports, localDay, type Report } from '../data'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Button, brewLabel, fmtClock, fmtDate, fmtNum, fmtTime } from '../ui'

// Rendered a page at a time: images load lazily, but every card is still a DOM node and an <img>
const PAGE = 20

// The Diary as photo cards (#/profile/feed): reports with a photo, newest first.
export default function Feed({ fileReport }: { fileReport: () => void }) {
  const { t } = useStore()
  const data = useReports()
  const [shown, setShown] = useState(PAGE)

  if (data.loading) return <p className="text-sm text-ink/70" role="status">{t('loading')}</p>
  if (!data.signedIn) {
    return (
      <p className="text-sm text-ink/80">
        {t('feed.guest')}{' '}
        <a href={SIGN_IN_URL} className="font-semibold text-ink underline">{t('auth.signIn')}</a>
      </p>
    )
  }

  const cards = feedReports(data.reports)
  if (cards.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink/80">{t('feed.empty')}</p>
        <Button variant="secondary" onClick={fileReport}>{t('feed.file')}</Button>
      </div>
    )
  }

  return (
    <>
      <p className="text-sm text-muted">{t('feed.count', { n: cards.length })}</p>
      <ul className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
        {cards.slice(0, shown).map((r) => (
          <FeedCard key={r.id} r={r} />
        ))}
      </ul>
      {shown < cards.length && (
        <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
          {t('feed.more')}
        </Button>
      )}
    </>
  )
}

function FeedCard({ r }: { r: Report & { photo: string } }) {
  const { t, lang } = useStore()
  const { coffees } = useReports()
  const coffee = coffeeName(r.lot, coffees)
  const date = `${fmtDate(localDay(r.ts), lang)} · ${fmtClock(r.ts, lang)}`
  return (
    <li className="overflow-hidden rounded-xl border-2 border-ink bg-cream">
      {/* fixed ratio, so nothing jumps while the photos load */}
      <img
        src={photoUrl(r.id, r.photo)}
        alt={t('photo.alt', { date })}
        loading="lazy"
        decoding="async"
        className="aspect-[4/5] w-full border-b-2 border-ink bg-line object-cover"
      />
      <div className="flex flex-col gap-1 p-4">
        <span className="font-semibold">
          {brewLabel(t, r)}
          {coffee && <span className="font-normal text-muted"> · {coffee}</span>}
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-[22px] font-extrabold leading-none tracking-wide">
            {fmtNum(r.dose)} g → {fmtNum(r.yield)} g · {fmtTime(r.time, r.method)}
          </span>
          <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${r.taste === 'balanced' ? 'bg-olive text-cream' : 'border-2 border-ink text-ink'}`}>
            {t(`taste.${r.taste}`)}
          </span>
        </div>
        {r.grinder && <p className="text-sm text-ink/80">{t('saved.grinder', { g: r.grinder })}</p>}
        <time dateTime={new Date(r.ts).toISOString()} className="text-xs text-muted">{date}</time>
      </div>
    </li>
  )
}
