import { formById, maxTotal, scoreSample } from '../cupping'
import { discardDraft, useCuppingSession } from '../cupping-draft'
import { MAX_PLACE, MAX_SAMPLES, compareSamples, namesHidden, newSample, newSession, nextCode, withoutSample, type CuppingSession } from '../cuppings'
import { MAX_NOTES, localDay } from '../data'
import type { Key } from '../i18n'
import { useReports } from '../reports'
import { useStore } from '../store'
import { newReportId } from '../sync'
import { Button, Card, Display, Label, ScreenTitle, field, fmtDate } from '../ui'
import { coffeeGroups, fmtScore, sampleName } from '../cupping-labels'
import CuppingSampleScreen from './CuppingSample'
import DatePicker from './DatePicker'
import SwipeRow from './SwipeRow'

// Profile > Cupping: the sessions, one session's table and summary, and (CuppingSample) one coffee's scores.
// Based on the SCA cupping form (src/cupping.ts); the app is not SCA-certified and gives no Q-grade.
// The route id is a session, or "<session>.<sample>" for one coffee in it.

const badge = 'rounded-full bg-line px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink'

export default function Cupping({ id, open }: { id?: string; open: (id?: string) => void }) {
  const [sessionId, sampleId] = id?.split('.') ?? []
  if (!sessionId) return <CuppingList open={open} />
  return <SessionScreen id={sessionId} sampleId={sampleId} open={open} />
}

function Disclaimer() {
  const { t } = useStore()
  return <p className="text-sm leading-snug text-muted">{t('cupping.disclaimer')}</p>
}

function CuppingList({ open }: { open: (id?: string) => void }) {
  const { t, lang } = useStore()
  const { cuppings, saveCupping, deleteCupping } = useReports()
  const start = () => {
    const s = newSession(newReportId(), Date.now())
    saveCupping(s)
    open(s.id)
  }
  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle title={t('cupping.title')} sub={t('cupping.sub')} />
      <Disclaimer />
      <Button onClick={start}>{t('cupping.new')}</Button>
      {cuppings.length === 0 ? (
        <p className="text-[15px] text-ink/80">{t('cupping.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cuppings.map((s) => {
            const best = compareSamples(s).find((r) => r.score?.complete)?.score
            return (
              <li key={s.id}>
                <SwipeRow
                  className="rounded-xl"
                  action={{
                    label: t('swipe.delete'),
                    tone: 'danger',
                    onAction: () => {
                      discardDraft(s.id)
                      deleteCupping(s.id)
                    },
                  }}
                >
                <button type="button" onClick={() => open(s.id)} className="w-full rounded-xl border-2 border-ink bg-cream p-4 text-left active:scale-[0.99]">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-[17px] font-semibold">{fmtDate(s.day, lang)}</span>
                    {s.blind && <span className={badge}>{t('cupping.blindBadge')}</span>}
                    {s.status === 'draft' && <span className={badge}>{t('cupping.draft')}</span>}
                  </div>
                  <div className="mt-1 flex gap-3 text-sm text-muted">
                    {s.place && <span className="truncate">{s.place}</span>}
                    <span>{t('cupping.count', { n: s.samples.length })}</span>
                    {best && <span>{t('cupping.best', { score: fmtScore(best.final) })}</span>}
                  </div>
                </button>
                </SwipeRow>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SessionScreen({ id, sampleId, open }: { id: string; sampleId?: string; open: (id?: string) => void }) {
  const { t } = useStore()
  const { session, change, discard } = useCuppingSession(id)
  if (!session) {
    return (
      <div className="mt-2 flex flex-col gap-4">
        <p className="text-[15px]">{t('cupping.notFound')}</p>
        <Button variant="secondary" onClick={() => open()}>
          {t('cupping.toList')}
        </Button>
      </div>
    )
  }
  const sample = sampleId ? session.samples.find((x) => x.id === sampleId) : undefined
  if (sample) return <CuppingSampleScreen session={session} sample={sample} change={change} open={open} />
  return <SessionView session={session} change={change} discard={discard} open={open} />
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-12 w-full items-center gap-3 text-left">
      <span className="flex-1 text-[17px] font-semibold">{label}</span>
      <span className={`flex h-8 w-14 items-center rounded-full border-2 border-ink p-0.5 transition-colors ${on ? 'bg-olive' : 'bg-line'}`}>
        <span className={`h-6 w-6 rounded-full border-2 border-ink bg-cream transition-transform ${on ? 'translate-x-6' : ''}`} />
      </span>
    </button>
  )
}

function SessionView({
  session,
  change,
  discard,
  open,
}: {
  session: CuppingSession
  change: (f: (s: CuppingSession) => CuppingSession) => void
  discard: () => void
  open: (id?: string) => void
}) {
  const { t, lang } = useStore()
  const { coffees, deleteCupping } = useReports()
  const set = (fields: Partial<CuppingSession>) => change((s) => ({ ...s, ...fields }))
  const ranked = compareSamples(session).filter((r) => r.score?.complete)
  const full = maxTotal(formById('sca')!)

  const addSample = () => {
    const x = { ...newSample(newReportId()), code: nextCode(session) }
    change((s) => ({ ...s, samples: [...s.samples, x] }))
    open(`${session.id}.${x.id}`)
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <ScreenTitle title={t('cupping.title')} sub={fmtDate(session.day, lang)} />
        <Disclaimer />

        <Card className="flex flex-col gap-3">
          <DatePicker inCard label={t('cupping.day')} value={session.day} max={localDay(Date.now())} onChange={(day) => day && set({ day })} />
          <label className="flex flex-col gap-1">
            <Label>{t('cupping.place')}</Label>
            <input
              value={session.place ?? ''}
              maxLength={MAX_PLACE}
              placeholder={t('cupping.placeHint')}
              onChange={(e) => set({ place: e.target.value || undefined })}
              className={`${field} h-11`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label>{t('cupping.protocol')}</Label>
            <textarea
              value={session.protocol ?? ''}
              maxLength={MAX_NOTES}
              rows={2}
              placeholder={t('cupping.protocolHint')}
              onChange={(e) => set({ protocol: e.target.value || undefined })}
              className={`${field} resize-none py-2`}
            />
          </label>
          <div>
            <Toggle label={t('cupping.blind')} on={session.blind} onChange={(blind) => set({ blind, revealed: false })} />
            <p className="text-sm leading-snug text-muted">{t('cupping.blindNote')}</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          <Label>{t('cupping.samples')}</Label>
          {session.samples.length === 0 && <p className="text-[15px] text-ink/80">{t('cupping.noSamples')}</p>}
          <ul className="flex flex-col">
            {session.samples.map((x) => {
              const form = formById(x.form)
              const score = form ? scoreSample(form, x.marks) : null
              return (
                <li key={x.id}>
                  <SwipeRow action={{ label: t('swipe.remove'), tone: 'danger', onAction: () => change((s) => withoutSample(s, x.id)) }}>
                  <button type="button" onClick={() => open(`${session.id}.${x.id}`)} className="flex min-h-14 w-full items-center gap-3 border-b border-line px-1 text-left">
                    <span className="flex-1">
                      <span className="block text-[17px] font-semibold">{sampleName(t, session, x, coffees)}</span>
                      {form && x.marks.cupCount !== form.cups && <span className="text-sm text-muted">{t('cupping.fewerCupsShort', { n: x.marks.cupCount })}</span>}
                    </span>
                    <span className="text-sm text-muted">
                      {!score ? t('cupping.unscored') : score.complete ? fmtScore(score.final) : t('cupping.left', { n: score.missing.length })}
                    </span>
                    <span aria-hidden="true" className="text-xl">›</span>
                  </button>
                  </SwipeRow>
                </li>
              )
            })}
          </ul>
          {session.samples.length < MAX_SAMPLES ? (
            <Button variant="secondary" onClick={addSample}>
              {t('cupping.addSample')}
            </Button>
          ) : (
            <p className="text-sm text-muted">{t('cupping.maxSamples', { n: MAX_SAMPLES })}</p>
          )}
          {namesHidden(session) && session.samples.length > 0 && (
            <Button
              onClick={() => {
                if (window.confirm(t('cupping.revealConfirm'))) set({ revealed: true })
              }}
            >
              {t('cupping.reveal')}
            </Button>
          )}
        </Card>

        <Card>
          <Label>{t('cupping.summary')}</Label>
          {ranked.length === 0 ? (
            <p className="mt-2 text-[15px] text-ink/80">{t('cupping.summaryEmpty')}</p>
          ) : (
            <ol className="mt-2 flex flex-col gap-3">
              {ranked.map(({ sample, score }, i) => (
                <li key={sample.id}>
                  <div className="flex items-baseline gap-3">
                    <Display className="w-6 text-2xl">{i + 1}</Display>
                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{sampleName(t, session, sample, coffees)}</span>
                    <Display className="text-[28px] !normal-case">{fmtScore(score!.final)}</Display>
                  </div>
                  <div className="ml-9 flex items-center gap-2">
                    {/* the bar runs from 60 (all sixes, some defects) to the form's best */}
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <div className="h-full rounded-full bg-olive" style={{ width: `${Math.max(0, Math.min(100, ((score!.final - 60) / (full - 60)) * 100))}%` }} />
                    </div>
                    <span className="text-sm text-muted">{t(`cupping.band.${score!.band}` as Key)}</span>
                  </div>
                  {!score!.fullCups && <p className="ml-9 text-xs text-muted">{t('cupping.fewerCupsShort', { n: sample.marks.cupCount })}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Button variant="secondary" onClick={() => set({ status: session.status === 'draft' ? 'done' : 'draft' })}>
          {session.status === 'draft' ? t('cupping.finish') : t('cupping.reopen')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (!window.confirm(t('cupping.deleteConfirm'))) return
            discard()
            deleteCupping(session.id)
            open()
          }}
        >
          {t('cupping.delete')}
        </Button>
      </div>
    </div>
  )
}
