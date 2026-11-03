import { useState } from 'react'
import {
  formById,
  levelOf,
  scoreSample,
  stepScore,
  withCupCount,
  attributeScore,
  type CupsAttribute,
  type Defect,
  type FormDef,
  type SampleMarks,
  type ScaleAttribute,
} from '../cupping'
import { MAX_CODE, MAX_NOTES, namesHidden, type CuppingSample, type CuppingSession } from '../cuppings'
import { FAMILIES, suggestFlavors } from '../flavors'
import type { Key } from '../i18n'
import { lotBySlug } from '../lots'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Button, Card, Display, Label, Segmented, Select, SmallButton, field } from '../ui'
import { coffeeGroups, fmtScore, sampleName } from '../cupping-labels'
import FlavorPicker from './FlavorPicker'

// One coffee's scores: every attribute on one screen, big steppers and cup toggles (no keyboard for scores), and the
// live total pinned above the tab bar.

// What a defect can be named as: the off-notes, ferment and green flavors
const DEFECT_FLAVORS = FAMILIES.filter((f) => f.off || f.id === 'fermented' || f.id === 'green').flatMap((f) => f.specifics.map((s) => `${f.id}.${s}`))

const big = 'flex h-14 w-14 flex-none items-center justify-center rounded-xl border-2 border-ink bg-sage text-3xl font-bold leading-none text-ink active:scale-95 disabled:opacity-40'
const small = 'flex h-11 w-11 flex-none items-center justify-center rounded-lg border-2 border-ink bg-sage text-2xl font-bold leading-none text-ink active:scale-95 disabled:opacity-40'

export default function CuppingSampleScreen({
  session,
  sample,
  change,
  open,
}: {
  session: CuppingSession
  sample: CuppingSample
  change: (f: (s: CuppingSession) => CuppingSession) => void
  open: (id?: string) => void
}) {
  const { t, lang } = useStore()
  const { coffees, reports } = useReports()
  // blind: whoever lays out the table picks the coffee, then it hides again
  const [setting, setSetting] = useState(false)
  const form = formById(sample.form)
  const hidden = namesHidden(session)
  const i = session.samples.indexOf(sample)
  const prev = session.samples[i - 1]
  const next = session.samples[i + 1]

  const setSample = (f: (x: CuppingSample) => CuppingSample) =>
    change((s) => ({ ...s, samples: s.samples.map((x) => (x.id === sample.id ? f(x) : x)) }))
  const setMarks = (f: (m: SampleMarks) => SampleMarks) => setSample((x) => ({ ...x, marks: f(x.marks) }))

  // a blind sample suggests no flavors: the roaster's notes would give the coffee away
  const suggested = suggestFlavors(hidden ? [] : (lotBySlug(sample.lot)?.flavors ?? []), reports.slice(0, 10).map((r) => r.flavors ?? []))

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <Display className="text-[36px] tracking-wide">{sampleName(t, session, sample, coffees)}</Display>
          {sample.code && !hidden && <p className="mt-1 text-[15px] text-ink/80">{t('cupping.cupCode', { code: sample.code })}</p>}
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>{t('cupping.coffee')}</Label>
            {hidden && !setting ? (
              <>
                <p className="flex h-11 items-center rounded-lg bg-line/60 px-3 text-[15px] text-muted">
                  {sample.lot ? t('cupping.coffeeSet') : t('cupping.hidden')}
                </p>
                <SmallButton onClick={() => setSetting(true)}>{t('cupping.setCoffee')}</SmallButton>
                <p className="text-sm leading-snug text-muted">{t('cupping.setCoffeeNote')}</p>
              </>
            ) : (
              <Select
                inCard
                label={t('cupping.coffee')}
                value={sample.lot ?? ''}
                groups={coffeeGroups(t, lang, coffees, sample.lot)}
                onChange={(lot) => {
                  setSample((x) => ({ ...x, lot: lot || undefined }))
                  setSetting(false)
                }}
              />
            )}
          </div>
          <label className="flex flex-col gap-1">
            <Label>{t('cupping.code')}</Label>
            <input
              value={sample.code ?? ''}
              maxLength={MAX_CODE}
              onChange={(e) => setSample((x) => ({ ...x, code: e.target.value.trim() ? e.target.value : undefined }))}
              className={`${field} h-11 w-28 font-semibold uppercase`}
            />
          </label>
          {form && (
            <div className="flex flex-col gap-1">
              <Label>{t('cupping.cups')}</Label>
              <Segmented
                inCard
                label={t('cupping.cups')}
                value={String(sample.marks.cupCount)}
                onChange={(n) => setMarks((m) => withCupCount(form, m, Number(n)))}
                options={Array.from({ length: form.cups - form.minCups + 1 }, (_, k) => String(form.minCups + k)).map((n) => ({ id: n, label: n }))}
              />
              {sample.marks.cupCount !== form.cups && <p className="text-sm leading-snug text-muted">{t('cupping.fewerCups', { n: sample.marks.cupCount })}</p>}
            </div>
          )}
        </Card>

        {form ? <Scores form={form} marks={sample.marks} setMarks={setMarks} /> : <p className="text-[15px]">{t('cupping.unscored')}</p>}
      </div>

      <div className="flex flex-col gap-4">
        {form && <Defects form={form} marks={sample.marks} setMarks={setMarks} />}

        <Card>
          <FlavorPicker value={sample.flavors ?? []} onChange={(flavors) => setSample((x) => ({ ...x, flavors: flavors.length ? flavors : undefined }))} suggested={suggested} />
        </Card>

        <Card>
          <label className="flex flex-col gap-1">
            <Label>{t('cupping.notes')}</Label>
            <textarea
              value={sample.notes ?? ''}
              maxLength={MAX_NOTES}
              rows={3}
              placeholder={t('cupping.notesHint')}
              onChange={(e) => setSample((x) => ({ ...x, notes: e.target.value || undefined }))}
              className={`${field} resize-none py-2`}
            />
          </label>
        </Card>

        {/* the way on is never a dead button: after the last coffee comes the summary */}
        <div className="flex flex-col gap-3">
          <Button onClick={() => open(next ? `${session.id}.${next.id}` : session.id)}>{next ? `${t('cupping.next')} →` : t('cupping.toSummary')}</Button>
          {prev && (
            <Button variant="secondary" onClick={() => open(`${session.id}.${prev.id}`)}>
              ← {t('cupping.prev')}
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            if (!window.confirm(t('cupping.removeSampleConfirm'))) return
            change((s) => ({ ...s, samples: s.samples.filter((x) => x.id !== sample.id) }))
            open(session.id)
          }}
        >
          {t('cupping.removeSample')}
        </Button>
      </div>

      {form && <TotalBar form={form} marks={sample.marks} />}
    </div>
  )
}

function Scores({ form, marks, setMarks }: { form: FormDef; marks: SampleMarks; setMarks: (f: (m: SampleMarks) => SampleMarks) => void }) {
  return (
    <Card className="!py-1">
      {form.attributes.map((a) =>
        a.kind === 'scale' ? (
          <ScaleRow key={a.id} form={form} a={a} value={marks.scores[a.id]} onChange={(v) => setMarks((m) => ({ ...m, scores: { ...m.scores, [a.id]: v } }))} />
        ) : (
          <CupsRow
            key={a.id}
            form={form}
            a={a}
            marks={marks}
            onToggle={(cup) => setMarks((m) => ({ ...m, cups: { ...m.cups, [a.id]: (m.cups[a.id] ?? []).map((on, k) => (k === cup ? !on : on)) } }))}
          />
        ),
      )}
    </Card>
  )
}

function ScaleRow({ form, a, value, onChange }: { form: FormDef; a: ScaleAttribute; value: number | undefined; onChange: (v: number) => void }) {
  const { t } = useStore()
  const label = t(`cupping.attr.${a.id}` as Key)
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Label>{label}</Label>
        <div className="mt-1 flex items-baseline gap-2">
          <Display className={`text-[34px] !normal-case tracking-wide ${value === undefined ? 'text-muted' : ''}`}>{value === undefined ? '—' : fmtScore(value)}</Display>
          <span className="truncate text-sm text-muted">{value === undefined ? t('cupping.tapToScore') : t(`cupping.level.${levelOf(form, value)}` as Key)}</span>
        </div>
      </div>
      <button type="button" aria-label={`${label} −`} className={big} disabled={value === a.min} onClick={() => onChange(stepScore(a, value, -1))}>
        −
      </button>
      <button type="button" aria-label={`${label} +`} className={big} disabled={value === a.max} onClick={() => onChange(stepScore(a, value, 1))}>
        +
      </button>
    </div>
  )
}

function CupsRow({ form, a, marks, onToggle }: { form: FormDef; a: CupsAttribute; marks: SampleMarks; onToggle: (cup: number) => void }) {
  const { t } = useStore()
  const label = t(`cupping.attr.${a.id}` as Key)
  const cups = marks.cups[a.id] ?? []
  return (
    <div role="group" aria-label={label} className="border-b border-line py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        <Display className="text-[26px] !normal-case">{fmtScore(attributeScore(form, marks, a) ?? 0)}</Display>
      </div>
      <div className="mt-2 flex gap-2">
        {cups.map((on, k) => (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            aria-label={t('cupping.cupN', { n: k + 1 })}
            onClick={() => onToggle(k)}
            className={`flex h-12 flex-1 items-center justify-center rounded-full border-2 border-ink text-lg font-bold active:scale-95 ${on ? 'bg-olive text-cream' : 'bg-cream text-ink line-through'}`}
          >
            {k + 1}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">{t('cupping.perCupHint')}</p>
    </div>
  )
}

function Defects({ form, marks, setMarks }: { form: FormDef; marks: SampleMarks; setMarks: (f: (m: SampleMarks) => SampleMarks) => void }) {
  const { t } = useStore()
  const setDefect = (k: number, d: Defect) => setMarks((m) => ({ ...m, defects: m.defects.map((x, j) => (j === k ? d : x)) }))
  const flavorGroups = [
    { label: '', options: [{ id: '', label: t('cupping.defectNone') }, ...DEFECT_FLAVORS.map((id) => ({ id, label: t(`flavor.${id}` as Key) }))] },
  ]
  return (
    <Card className="flex flex-col gap-3">
      <Label>{t('cupping.defects')}</Label>
      {marks.defects.map((d, k) => (
        <div key={k} className="flex flex-col gap-2 rounded-lg bg-line/40 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Segmented
                inCard
                label={t('cupping.defectKind')}
                value={d.kind}
                onChange={(kind) => setDefect(k, { ...d, kind })}
                options={(['taint', 'fault'] as const).map((id) => ({ id, label: t(`cupping.${id}`) }))}
              />
            </div>
            <button
              type="button"
              aria-label={t('cupping.defectRemove')}
              onClick={() => setMarks((m) => ({ ...m, defects: m.defects.filter((_, j) => j !== k) }))}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-2xl leading-none text-ink"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[15px] font-semibold">{t('cupping.defectCups')}</span>
            <button type="button" aria-label={`${t('cupping.defectCups')} −`} className={small} disabled={d.cups <= 1} onClick={() => setDefect(k, { ...d, cups: d.cups - 1 })}>
              −
            </button>
            <Display className="w-8 text-center text-[28px]">{d.cups}</Display>
            <button
              type="button"
              aria-label={`${t('cupping.defectCups')} +`}
              className={small}
              disabled={d.cups >= marks.cupCount}
              onClick={() => setDefect(k, { ...d, cups: d.cups + 1 })}
            >
              +
            </button>
          </div>
          <Select
            inCard
            label={t('cupping.defectWhat')}
            value={d.flavor ?? ''}
            groups={flavorGroups}
            onChange={(flavor) => {
              const { flavor: _old, ...rest } = d
              setDefect(k, flavor ? { ...rest, flavor } : rest)
            }}
          />
        </div>
      ))}
      {marks.defects.length < form.defects.maxRows && (
        <Button variant="secondary" onClick={() => setMarks((m) => ({ ...m, defects: [...m.defects, { kind: 'taint', cups: 1 }] }))}>
          {t('cupping.defectAdd')}
        </Button>
      )}
      <p className="text-sm leading-snug text-muted">{t('cupping.defectNote')}</p>
    </Card>
  )
}

// Pinned above the tab bar on a phone, so the total is always in sight while scoring
function TotalBar({ form, marks }: { form: FormDef; marks: SampleMarks }) {
  const { t } = useStore()
  const s = scoreSample(form, marks)
  return (
    <div
      aria-live="polite"
      className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[5] flex items-center gap-4 rounded-xl border-2 border-ink bg-olive px-4 py-2 text-cream lg:bottom-4 lg:col-span-2"
    >
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.12em]">{t('cupping.total')}</div>
        <Display className="text-[22px] !normal-case">{fmtScore(s.total)}</Display>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.12em]">{t('cupping.defects')}</div>
        <Display className="text-[22px] !normal-case">{s.defects ? `−${fmtScore(s.defects)}` : '0'}</Display>
      </div>
      <div className="ml-auto text-right">
        <div className="text-xs font-semibold uppercase tracking-[0.12em]">{s.complete ? t(`cupping.band.${s.band}` as Key) : t('cupping.left', { n: s.missing.length })}</div>
        <Display className="text-[34px] !normal-case">{fmtScore(s.final)}</Display>
      </div>
    </div>
  )
}
