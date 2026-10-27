import { AccountCard, LangToggle } from '../account'
import { CHAPTERS } from '../data'
import { useReports } from '../reports'
import type { Sub } from '../route'
import { useStore } from '../store'
import { Button, Card, Label, RowButton, ScreenTitle } from '../ui'
import RankCard from './RankCard'

// Account, progress and everything that belongs to the player; each row opens a sub-screen
export default function Profile({ open }: { open: (s: Sub) => void }) {
  const { t, reset } = useStore()
  const data = useReports()
  const { missions, rank } = data
  const saved = data.loading ? null : Object.values(data.working).filter((id) => data.reports.some((x) => x.id === id)).length
  const done = missions.filter((m) => m.done).length
  const chapters = CHAPTERS.filter((c) => rank.idx >= c.rank).length

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
          <RowButton label={t('coffee.mine')} value={String(data.coffees.filter((c) => !c.archived).length)} onClick={() => open('coffees')} />
          <RowButton label={t('saved.title')} value={saved === null ? '…' : String(saved)} onClick={() => open('saved')} />
          <RowButton label={t('diary.title')} value={data.loading ? '…' : String(data.reports.length)} onClick={() => open('diary')} />
          <RowButton label={t('m.title')} value={t('m.done', { n: done, total: missions.length })} onClick={() => open('missions')} />
          <RowButton label={t('dos.title')} value={t('profile.chapters', { n: chapters, total: CHAPTERS.length })} onClick={() => open('dossier')} />
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
