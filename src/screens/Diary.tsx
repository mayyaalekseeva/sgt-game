import { useMemo, useState } from 'react'
import { MAX_GRINDER, MAX_NOTES, RECIPES, RECIPE_CONTENT, diaryDays, localDay, slugOf, versionOf, type Report } from '../data'
import { isDiagId } from '../diagnose'
import { coffeeName, workingKey } from '../coffees'
import { brewChanges, diaryCoffees, diarySummary, lastWeek, previousBrews } from '../diary'
import { photoUrl } from '../api'
import { useReports } from '../reports'
import { useStore } from '../store'
import { grinderName, grinderText } from '../grinders'
import GrinderSelect from './GrinderSelect'
import PhotoControl from './PhotoControl'
import { Button, Label, ScreenTitle, brewLabel, diagVars, fmtClock, fmtDate, fmtNum, fmtTime, ratio, signed } from '../ui'

const DAY = 24 * 60 * 60 * 1000
// Cards come a page at a time: a card can hold a photo
const PAGE = 20

// One timeline of every report, newest first, grouped by day, and filtered by coffee if one is picked.
// Signed-in users read the API; guests read this browser.
export default function Diary() {
  const { t, lang } = useStore()
  const data = useReports()
  const [picked, setPicked] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)

  const coffees = useMemo(() => diaryCoffees(data.reports), [data.reports])
  const previous = useMemo(() => previousBrews(data.reports), [data.reports])
  // the picked coffee may have gone (its reports deleted)
  const coffee = picked && coffees.includes(picked) ? picked : null
  const reports = coffee ? data.reports.filter((r) => r.lot === coffee) : data.reports
  const pick = (c: string | null) => {
    setPicked(c)
    setShown(PAGE)
  }

  const brews = (n: number) => (n === 1 ? t('diary.brew1') : t('diary.brewN', { n }))
  const summary = (() => {
    if (coffee) {
      const s = diarySummary(reports)
      return t('diary.coffeeSummary', { brews: brews(s.brews), b: s.balanced })
    }
    const s = diarySummary(lastWeek(data.reports, Date.now()))
    return s.brews ? t('diary.week', { brews: brews(s.brews), b: s.balanced }) : t('diary.weekNone')
  })()

  const today = localDay(Date.now())
  const yesterday = localDay(Date.now() - DAY)
  const dayLabel = (d: string) => (d === today ? t('diary.today') : d === yesterday ? t('diary.yesterday') : fmtDate(d, lang))

  return (
    <div className="flex flex-col gap-4 lg:max-w-3xl">
      <ScreenTitle title={t('diary.title')} sub={t('diary.sub')} />
      {data.loading ? (
        <p className="text-sm text-ink/70" role="status">{t('loading')}</p>
      ) : data.reports.length === 0 ? (
        <p className="text-sm text-ink/70">{t('diag.noHistory')}</p>
      ) : (
        <>
          {coffees.length > 0 && (
            // scrolls sideways on a phone, edge to edge
            <div role="group" aria-label={t('diary.filter')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
              <Chip on={!coffee} onClick={() => pick(null)}>{t('diary.all')}</Chip>
              {coffees.map((c) => (
                <Chip key={c} on={coffee === c} onClick={() => pick(c)}>{coffeeName(c, data.coffees) ?? c}</Chip>
              ))}
            </div>
          )}
          <p className="text-sm font-semibold text-ink/80">{summary}</p>
          {diaryDays(reports.slice(0, shown)).map(({ day, reports: rs }) => (
            <section key={day} className="flex flex-col gap-2" aria-label={dayLabel(day)}>
              <Label>{dayLabel(day)}</Label>
              <ul className="flex flex-col gap-3">
                {rs.map((r) => (
                  <Entry key={r.id} r={r} prev={previous.get(r.id)} isWorking={data.working[workingKey(r)] === r.id} />
                ))}
              </ul>
            </section>
          ))}
          {shown < reports.length && (
            <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>{t('diary.more')}</Button>
          )}
        </>
      )}
      {data.source === 'browser' && <p className="text-xs text-ink/70">{t('diary.local')}</p>}
    </div>
  )
}

function Chip({ children, on, onClick }: { children: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-11 flex-none whitespace-nowrap rounded-full border-2 border-ink px-4 text-[15px] font-semibold ${on ? 'bg-ink text-cream' : 'bg-cream text-ink'}`}
    >
      {children}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="text-[17px] font-semibold">{value}</div>
    </div>
  )
}

// "yield +2 g, time −3 s, grinder 14 → 13", or "Same recipe as last time"
function SinceLast({ prev, r }: { prev: Report; r: Report }) {
  const { t, lang } = useStore()
  const changes = brewChanges(prev, r)
  if (changes.length === 0) return <p className="text-sm text-ink/80">{t('diary.same')}</p>
  const name = { dose: t('recipe.dose'), yield: t(r.method === 'filter' ? 'recipe.water' : 'recipe.yield'), time: t('recipe.time') }
  const parts = changes.map((c) =>
    c.field === 'grinder'
      ? t('diary.grinderChange', { from: c.from, to: c.to })
      : c.field === 'grinderModel'
        ? t('diary.grinderModelChange', { to: grinderName(c.to) })
        : `${name[c.field].toLocaleLowerCase(lang)} ${signed(c.delta, c.field === 'time' ? ' s' : ' g')}`,
  )
  return <p className="text-sm font-semibold text-ink">{t('diary.sinceLast', { changes: parts.join(', ') })}</p>
}

function Entry({ r, prev, isWorking }: { r: Report; prev?: Report; isWorking: boolean }) {
  const { t, lang } = useStore()
  const { coffees, signedIn } = useReports()
  const [editing, setEditing] = useState(false)
  const coffee = coffeeName(r.lot, coffees)
  const v = versionOf(RECIPE_CONTENT, r.recipeVersionId)
  const recipe = v ?? RECIPES[slugOf(r)]
  const photo = signedIn && !editing ? r.photo : undefined
  return (
    <li className="flex flex-col gap-2 rounded-xl border-2 border-ink bg-cream p-4">
      {/* The coffee is the title; older reports without one are titled by the brew */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-[19px] font-bold leading-tight">{coffee ?? brewLabel(t, r)}</h3>
          {!editing && (
            <button
              type="button"
              aria-label={t('diary.edit')}
              onClick={() => setEditing(true)}
              className="-my-2.5 -mr-3 flex h-11 w-11 flex-none items-center justify-center text-ink"
            >
              <Pencil />
            </button>
          )}
        </div>
        <p className="text-sm text-muted">
          {coffee && `${brewLabel(t, r)} · `}
          {fmtClock(r.ts, lang)}
          {r.editedAt && ` · ${t('diary.edited')}`}
        </p>
      </div>
      <div className="grid max-w-md grid-cols-4 gap-2">
        <Stat label={t('recipe.dose')} value={`${fmtNum(r.dose)} g`} />
        <Stat label={t(r.method === 'filter' ? 'recipe.water' : 'recipe.yield')} value={`${fmtNum(r.yield)} g`} />
        <Stat label={t('recipe.time')} value={fmtTime(r.time, r.method)} />
        <Stat label={t('diary.ratio')} value={`1:${ratio(r)}`} />
      </div>
      {editing ? (
        <EditEntry r={r} done={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`whitespace-nowrap rounded-full px-3 py-0.5 text-sm font-semibold ${r.taste === 'balanced' ? 'bg-olive text-cream' : 'border-2 border-ink text-ink'}`}>
                {t(`taste.${r.taste}`)}
              </span>
              {isDiagId(r.diag) && <span className="text-[15px] font-semibold">{t(`d.${r.diag}.title`)}</span>}
            </div>
            {isDiagId(r.diag) && <p className="text-sm leading-snug text-ink/80">{t(`d.${r.diag}.change`, diagVars(recipe, r.method))}</p>}
          </div>
          {prev && <SinceLast prev={prev} r={r} />}
          {(grinderText(r) || r.notes) && (
            <p className="text-sm leading-snug text-ink/80">
              {grinderText(r) && <span className="font-semibold text-ink">{t('saved.grinder', { g: grinderText(r) })}</span>}
              {grinderText(r) && r.notes && ' · '}
              {r.notes}
            </p>
          )}
          {(v || isWorking) && (
            <div className="flex flex-wrap gap-2">
              {v && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t('diary.recipeV', { n: v.version })}</span>}
              {isWorking && <span className="rounded-full bg-olive px-2 py-0.5 text-xs font-semibold text-cream">{t('diary.working')}</span>}
            </div>
          )}
          {photo && (
            // a fixed frame, so nothing jumps while the photo loads
            <img
              src={photoUrl(r.id, photo)}
              alt={t('photo.alt', { date: fmtClock(r.ts, lang) })}
              loading="lazy"
              decoding="async"
              className="mt-1 aspect-[4/3] w-full max-w-md rounded-lg border-2 border-ink bg-line object-cover"
            />
          )}
        </>
      )}
    </li>
  )
}

function Pencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

const field = 'rounded-xl border-2 border-ink bg-cream px-3 text-[16px] text-ink placeholder:text-muted'

// Grinder, notes and photo. The numbers and taste are what was brewed and diagnosed, so they stay as filed;
// a wrong number is fixed by deleting the report and filing it again.
function EditEntry({ r, done }: { r: Report; done: () => void }) {
  const { t } = useStore()
  const { editReport, deleteReport, signedIn } = useReports()
  const [grinder, setGrinder] = useState(r.grinder ?? '')
  const [grinderModel, setGrinderModel] = useState(r.grinderModel ?? '')
  const [notes, setNotes] = useState(r.notes ?? '')
  const save = () => {
    editReport(r.id, { grinder, grinderModel, notes })
    done()
  }
  const remove = () => {
    if (window.confirm(t(signedIn && r.photo ? 'diary.deleteConfirmPhoto' : 'diary.deleteConfirm'))) deleteReport(r.id)
  }
  return (
    <div className="mt-2 flex flex-col gap-3">
      <GrinderSelect value={grinderModel} onChange={setGrinderModel} />
      <label className="flex flex-col gap-1">
        <Label>{t('diag.grinder')}</Label>
        <input value={grinder} maxLength={MAX_GRINDER} placeholder={t('diag.grinderHint')} onChange={(e) => setGrinder(e.target.value)} className={`${field} h-11 font-semibold placeholder:font-normal`} />
      </label>
      <label className="flex flex-col gap-1">
        <Label>{t('diag.notes')}</Label>
        <textarea value={notes} maxLength={MAX_NOTES} rows={2} placeholder={t('diag.notesHint')} onChange={(e) => setNotes(e.target.value)} className={`${field} py-2`} />
      </label>
      {signedIn && (
        <div className="flex flex-col gap-1">
          <Label>{t('photo.label')}</Label>
          <PhotoControl report={r} compact />
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-line pt-2">
        <button type="button" onClick={remove} className="mr-auto h-11 text-[15px] font-semibold text-ink underline">
          {t('diary.delete')}
        </button>
        <button type="button" onClick={done} className="h-11 px-3 text-[15px] font-semibold text-ink">
          {t('diary.cancel')}
        </button>
        <button type="button" onClick={save} className="h-11 rounded-xl border-2 border-ink bg-olive px-5 text-[15px] font-semibold text-cream active:scale-[0.98]">
          {t('diary.save')}
        </button>
      </div>
    </div>
  )
}
