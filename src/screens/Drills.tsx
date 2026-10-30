import type { Key } from '../i18n'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Card, Chevrons, Display } from '../ui'
import { LockIcon } from './Dossier'

// Every drill in order: open ones can be started, the next one opens when the field test before it is passed
export default function Drills({ open }: { open: (id: string) => void }) {
  const { t } = useStore()
  const { drills } = useReports()
  const done = drills.filter((d) => d.done).length
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Display className="text-[40px] tracking-wide">{t('drills.title')}</Display>
        <p className="mt-1 text-[15px] text-ink/80">{t('drills.sub')}</p>
        <p className="mt-1 text-sm font-semibold text-muted">{t('drills.done', { n: done, total: drills.length })}</p>
      </div>
      <ol className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
        {drills.map((d, i) => (
          <li key={d.id}>
            <button
              type="button"
              disabled={!d.unlocked}
              onClick={() => open(d.id)}
              className="block w-full text-left transition active:scale-[0.99] disabled:cursor-default disabled:active:scale-100 lg:h-full"
            >
              <Card className={`lg:h-full ${d.unlocked ? '' : 'border-locked bg-locked/40'}`}>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${d.done ? 'bg-olive text-cream' : d.unlocked ? 'border-2 border-olive text-olive' : 'border-2 border-locked text-muted'}`}
                  >
                    {d.unlocked ? <Chevrons n={1} size={16} /> : <LockIcon />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{String(i + 1).padStart(2, '0')}</div>
                    <Display className="text-[22px] tracking-wide">{t(`drill.${d.id}.t` as Key)}</Display>
                    <p className="mt-1 text-[15px] leading-snug">{t(`drill.${d.id}.sub` as Key)}</p>
                    {d.unlocked ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-semibold">{t('drills.quiz')}</span>
                          <span className={d.quizPassed ? 'font-semibold text-olive-soft' : 'text-muted'}>
                            {d.quizPassed ? `✓ ${t('drills.passed')}` : '—'}
                          </span>
                        </div>
                        {d.assignment && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{t('drill.task')}</span>
                            <div className="h-2 flex-1 rounded bg-line">
                              <div
                                className="h-2 origin-left animate-grow rounded bg-olive-soft"
                                style={{ width: `${(d.assignment.cur / d.assignment.goal) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted">{d.assignment.cur}/{d.assignment.goal}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-muted">{t('drills.locked')}</div>
                    )}
                  </div>
                </div>
              </Card>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
