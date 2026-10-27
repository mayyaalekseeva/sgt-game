import { RECIPES, RECIPE_CONTENT, diaryDays, localDay, slugOf, versionOf, type Report } from '../data'
import { isDiagId } from '../diagnose'
import { coffeeName, workingKey } from '../coffees'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Card, Label, ScreenTitle, brewLabel, diagVars, fmtClock, fmtDate, fmtNum, fmtTime } from '../ui'

const DAY = 24 * 60 * 60 * 1000

// Every report, grouped by day. Signed-in users read the API; guests read this browser.
export default function Diary() {
  const { t, lang } = useStore()
  const data = useReports()

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
          <p className="text-sm text-muted">{t('diary.count', { n: data.reports.length })}</p>
          {diaryDays(data.reports).map(({ day, reports: rs }) => (
            <section key={day} className="flex flex-col gap-2" aria-label={dayLabel(day)}>
              <Label>{dayLabel(day)}</Label>
              <Card className="!py-1">
                <ul>
                  {rs.map((r) => (
                    <Entry key={r.id} r={r} isWorking={data.working[workingKey(r)] === r.id} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </>
      )}
      {data.source === 'browser' && <p className="text-xs text-ink/70">{t('diary.local')}</p>}
    </div>
  )
}

function Entry({ r, isWorking }: { r: Report; isWorking: boolean }) {
  const { t, lang } = useStore()
  const { coffees } = useReports()
  const coffee = coffeeName(r.lot, coffees)
  const v = versionOf(RECIPE_CONTENT, r.recipeVersionId)
  const recipe = v ?? RECIPES[slugOf(r)]
  return (
    <li className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">
          {brewLabel(t, r)}
          {coffee && <span className="font-normal text-muted"> · {coffee}</span>}
        </span>
        <span className="whitespace-nowrap text-xs text-muted">{fmtClock(r.ts, lang)}</span>
      </div>
      <div className="text-[15px]">
        {fmtNum(r.dose)} g → {fmtNum(r.yield)} g · {fmtTime(r.time, r.method)} · {t(`taste.${r.taste}`)}
      </div>
      {(r.grinder || r.notes) && (
        <p className="text-sm leading-snug text-ink/80">
          {r.grinder && <span className="font-semibold text-ink">{t('saved.grinder', { g: r.grinder })}</span>}
          {r.grinder && r.notes && ' · '}
          {r.notes}
        </p>
      )}
      {isDiagId(r.diag) && (
        <p className="text-sm leading-snug text-ink/80">
          <span className="font-semibold text-ink">{t(`d.${r.diag}.title`)}</span> {t(`d.${r.diag}.change`, diagVars(recipe, r.method))}
        </p>
      )}
      {(v || isWorking) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {v && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t('diary.recipeV', { n: v.version })}</span>}
          {isWorking && (
            <span className="rounded-full bg-olive px-2 py-0.5 text-xs font-semibold text-cream">{t('diary.working')}</span>
          )}
        </div>
      )}
    </li>
  )
}
