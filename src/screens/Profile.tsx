import { AccountCard, LangToggle } from '../account'
import { LEVELS, profileRowsFor } from '../briefing'
import { CHAPTERS } from '../data'
import { currentLots } from '../lots'
import { useReports } from '../reports'
import type { Sub } from '../route'
import { useStore } from '../store'
import { Button, Card, Label, RowButton, ScreenTitle, Segmented } from '../ui'
import RankCard from './RankCard'

// Account, progress and everything that belongs to the player; each row opens a sub-screen
export default function Profile({ open }: { open: (s: Sub) => void }) {
  const { t, reset, briefing, setLevel, openBriefing } = useStore()
  const data = useReports()
  const { missions, rank } = data
  const saved = data.loading ? null : Object.values(data.working).filter((id) => data.reports.some((x) => x.id === id)).length
  const done = missions.filter((m) => m.done).length
  const drillsDone = data.drills.filter((d) => d.done).length
  const chapters = CHAPTERS.filter((c) => rank.idx >= c.rank).length
  const drafts = data.cuppings.filter((c) => c.status === 'draft').length
  // every row for every level; the level only puts some first (cupping, for a pro)
  const rows = profileRowsFor(
    [
      { id: 'lots', label: t('lots.title'), value: String(currentLots().length), sub: 'lots' as Sub },
      { id: 'coffees', label: t('coffee.mine'), value: String(data.coffees.filter((c) => !c.archived).length), sub: 'coffees' as Sub },
      { id: 'saved', label: t('saved.title'), value: saved === null ? '…' : String(saved), sub: 'saved' as Sub },
      { id: 'diary', label: t('diary.title'), value: data.loading ? '…' : String(data.reports.length), sub: 'diary' as Sub },
      { id: 'cupping', label: t('cupping.title'), value: drafts ? `${data.cuppings.length} · ${t('cupping.draft')}` : String(data.cuppings.length), sub: 'cupping' as Sub },
      { id: 'drills', label: t('drills.title'), value: t('drills.done', { n: drillsDone, total: data.drills.length }), sub: 'drills' as Sub },
      { id: 'missions', label: t('m.title'), value: t('m.done', { n: done, total: missions.length }), sub: 'missions' as Sub },
      { id: 'dossier', label: t('dos.title'), value: t('profile.chapters', { n: chapters, total: CHAPTERS.length }), sub: 'dossier' as Sub },
    ],
    briefing.level,
  )

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="lg:col-span-2">
        <ScreenTitle title={t('profile.title')} sub={t('profile.sub')} />
      </div>

      <div className="flex flex-col gap-4">
        <AccountCard />
        <RankCard />
      </div>

      <div className="flex flex-col gap-4">
        <Card className="!py-1">
          {rows.map((r) => (
            <RowButton key={r.id} label={r.label} value={r.value} onClick={() => open(r.sub)} />
          ))}
          <RowButton label={t('brief.replay')} onClick={openBriefing} />
        </Card>

        <Card>
          <Label>{t('level.title')}</Label>
          <div className="mt-2">
            <Segmented inCard label={t('level.title')} value={briefing.level} onChange={setLevel} options={LEVELS.map((l) => ({ id: l, label: t(`level.${l}`) }))} />
          </div>
          <p className="mt-2 text-sm leading-snug text-muted">{t('level.note')}</p>
        </Card>

        {/* desktop keeps the language switch in the sidebar */}
        <div className="flex flex-col gap-2 lg:hidden">
          <Label>{t('profile.language')}</Label>
          <LangToggle />
        </div>

        {/* erases this browser's guest progress; an account's reports live on the server */}
        {!data.signedIn && (
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(t('m.resetConfirm'))) reset()
            }}
          >
            {t('m.reset')}
          </Button>
        )}
      </div>
    </div>
  )
}
