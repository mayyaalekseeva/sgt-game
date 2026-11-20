import { useEffect, useState } from 'react'
import type { CuppingSession } from '../cuppings'
import { useStore } from '../store'
import { Button, Card, Display, Label, ScreenTitle } from '../ui'

// The break between the aroma round and the tasting: a checklist and a plain stopwatch. No target time is set here, the
// cupper decides when the cups have cooled. The start time is kept in this browser so leaving the screen does not lose it.

const key = (id: string) => `barista-game:cupping-break:${id}`

const read = (id: string): number | null => {
  try {
    const n = Number(localStorage.getItem(key(id)))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}
const write = (id: string, v: number | null) => {
  try {
    if (v) localStorage.setItem(key(id), String(v))
    else localStorage.removeItem(key(id))
  } catch {
    /* storage unavailable: the timer still runs on this screen */
  }
}

export const fmtElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function CuppingBreak({ session, open }: { session: CuppingSession; open: (id?: string) => void }) {
  const { t } = useStore()
  const [startedAt, setStartedAt] = useState(() => read(session.id))
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  const first = session.samples[0]
  const last = session.samples[session.samples.length - 1]
  const set = (v: number | null) => {
    setStartedAt(v)
    setNow(Date.now())
    write(session.id, v)
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle title={t('cupping.break.title')} sub={t('cupping.break.sub')} />
      <Card className="flex flex-col gap-3">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[16px]">
          <li>{t('cupping.break.step1')}</li>
          <li>{t('cupping.break.step2')}</li>
          <li>{t('cupping.break.step3')}</li>
        </ol>
      </Card>
      <Card className="flex flex-col gap-2">
        <Label>{t('cupping.break.timer')}</Label>
        <Display className="text-[56px] !normal-case" >{startedAt ? fmtElapsed(now - startedAt) : '00:00'}</Display>
        {startedAt ? (
          <Button variant="secondary" onClick={() => set(null)}>
            {t('cupping.break.reset')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => set(Date.now())}>
            {t('cupping.break.start')}
          </Button>
        )}
      </Card>
      {first ? (
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => {
              set(null)
              open(`${session.id}.${first.id}.tasting`)
            }}
          >
            {t('cupping.break.go')}
          </Button>
          <Button variant="secondary" onClick={() => open(`${session.id}.${last.id}.aroma`)}>
            {t('cupping.break.back')}
          </Button>
        </div>
      ) : (
        <p className="text-[15px] text-ink/80">{t('cupping.break.empty')}</p>
      )}
    </div>
  )
}
