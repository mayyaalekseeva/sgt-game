import { useState } from 'react'
import { CHAPTERS, RANKS } from '../data'
import type { Key } from '../i18n'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Card, Chevrons, Display } from '../ui'

export default function Dossier() {
  const { t } = useStore()
  const { rank } = useReports()
  const [open, setOpen] = useState<string | null>(CHAPTERS[0].id)
  return (
    <div className="flex flex-col gap-4 lg:max-w-3xl">
      <div>
        <Display className="text-[40px] tracking-wide">{t('dos.title')}</Display>
        <p className="mt-1 text-[15px] text-ink/80">{t('dos.sub')}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {CHAPTERS.map((c, i) => {
          const unlocked = rank.idx >= c.rank
          const isOpen = open === c.id && unlocked
          return (
            <li key={c.id}>
              <Card className={unlocked ? '' : 'border-locked bg-locked/40'}>
                <button
                  type="button"
                  disabled={!unlocked}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : c.id)}
                  className="flex w-full items-center gap-3 text-left disabled:cursor-default"
                >
                  <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${unlocked ? 'bg-olive text-cream' : 'border-2 border-locked text-muted'}`}>
                    {unlocked ? <Chevrons n={c.rank + 1} size={16} /> : <LockIcon />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <Display className="text-[22px] tracking-wide">{t(`${c.id}.t` as Key)}</Display>
                    {!unlocked && (
                      <div className="mt-1 text-xs text-muted">{t('dos.locked', { rank: t(`rank.${RANKS[c.rank].id}`) })}</div>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-[16px] leading-relaxed">{t(`${c.id}.b` as Key)}</p>
                    {c.id === 'c4' && (
                      <>
                        <div className="mt-3 flex gap-3">
                          <img src="./brand/sargento.jpg" alt="" className="h-32 w-1/2 rounded-lg border-2 border-ink object-cover lg:h-56" />
                          <img src="./brand/id-card.jpg" alt="" className="h-32 w-1/2 rounded-lg border-2 border-ink object-cover lg:h-56" />
                        </div>
                        <p className="mt-2 text-xs text-muted">{t('dos.draft')}</p>
                      </>
                    )}
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
