import type { Key } from '../i18n'
import { useStore } from '../store'
import { Card, Chevrons, Display } from '../ui'

export default function Missions() {
  const { t, missions } = useStore()
  const done = missions.filter((m) => m.done).length
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Display className="text-[40px] tracking-wide">{t('m.title')}</Display>
        <p className="mt-1 text-[15px] text-ink/80">{t('m.done', { n: done, total: missions.length })}</p>
      </div>
      <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
        {missions.map((m) => (
          <li key={m.id}>
            <Card className={`lg:h-full ${m.done ? '' : 'bg-cream/80'}`}>
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${m.done ? 'bg-olive text-cream' : 'border-2 border-locked text-locked'}`}
                >
                  <Chevrons n={1} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <Display className="text-[22px] tracking-wide">{t(`m.${m.id}.t` as Key)}</Display>
                    <span className="whitespace-nowrap text-sm font-semibold text-olive-soft">+{m.xp} {t('xp')}</span>
                  </div>
                  <p className="mt-1 text-[15px] leading-snug">{t(`m.${m.id}.d` as Key)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded bg-line">
                      <div className="h-2 rounded bg-olive-soft" style={{ width: `${(m.cur / m.goal) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted">{m.cur}/{m.goal}</span>
                  </div>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
