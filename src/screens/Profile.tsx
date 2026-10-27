import { AccountCard, LangToggle } from '../account'
import { CHAPTERS, METHODS, ROASTS, recipeKey } from '../data'
import { useReports } from '../reports'
import type { Sub } from '../route'
import { useStore } from '../store'
import { Button, Card, Label, RowButton, ScreenTitle } from '../ui'
import RankCard from './RankCard'

// Account, progress and everything that belongs to the player; each row opens a sub-screen
export default function Profile({ open }: { open: (s: Sub) => void }) {
  const { t, missions, rank, reset } = useStore()
  const data = useReports()
  const keys = METHODS.flatMap((m) => ROASTS.map((r) => recipeKey(m, r)))
  const saved = data ? keys.filter((k) => data.reports.some((x) => x.id === data.working[k])).length : null
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
          <RowButton label={t('saved.title')} value={saved === null ? '…' : String(saved)} onClick={() => open('saved')} />
          <RowButton label={t('diary.title')} value={data ? String(data.reports.length) : '…'} onClick={() => open('diary')} />
          <RowButton label={t('m.title')} value={t('m.done', { n: done, total: missions.length })} onClick={() => open('missions')} />
          <RowButton label={t('dos.title')} value={t('profile.chapters', { n: chapters, total: CHAPTERS.length })} onClick={() => open('dossier')} />
        </Card>

        {/* desktop keeps the language switch in the sidebar */}
        <div className="flex flex-col gap-2 lg:hidden">
          <Label>{t('profile.language')}</Label>
          <LangToggle />
        </div>

        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm(t('m.resetConfirm'))) reset()
          }}
        >
          {t('m.reset')}
        </Button>
      </div>
    </div>
  )
}
