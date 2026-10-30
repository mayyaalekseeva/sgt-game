import { Fragment, useState } from 'react'
import { loadRecipes, useLoad } from '../api'
import { BREWERS, METHODS, ROASTS, latestVersion, type RecipeEntry, type RecipeVersion } from '../data'
import { LOT_ROAST } from '../coffees'
import { usePick } from '../reports'
import { useStore } from '../store'
import { Card, Display, Label, ScreenTitle, SmallButton, fmtDate, fmtNum, fmtRange, ratio } from '../ui'
import RecipeSteps from './RecipeSteps'

// Picker order: roasts for espresso, brewers for filter
const order = (e: RecipeEntry) => (e.brewer ? BREWERS.indexOf(e.brewer) : ROASTS.indexOf(e.roast ?? 'medium'))

// The recipes on offer with their version history. "Use" picks one and opens Orders. Archived recipes are
// not shown: they stay in the content only so older reports keep their numbers.
export default function Recipes({ use }: { use: () => void }) {
  const { t } = useStore()
  const data = useLoad(loadRecipes)

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle title={t('recipes.title')} sub={t('recipes.sub')} />
      {!data ? (
        <p className="text-sm text-ink/70" role="status">{t('loading')}</p>
      ) : (
        <>
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
            {METHODS.map((m) => (
              <section key={m} className="flex flex-col gap-3" aria-label={t(`method.${m}`)}>
                <Label>{t(`method.${m}`)}</Label>
                <ul className="flex flex-col gap-3">
                  {data.recipes
                    // one espresso recipe until the roaster says each lot's roast; the others stay for older reports
                    .filter((e) => e.method === m && e.status !== 'archived' && (!e.roast || e.roast === LOT_ROAST))
                    .sort((a, b) => order(a) - order(b))
                    .map((e) => (
                      <li key={e.slug}>
                        <RecipeCard entry={e} use={use} />
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="text-xs text-ink/70">
            {t('diag.guideline')}
            {data.source === 'browser' && ` ${t('recipes.bundled')}`}
          </p>
        </>
      )}
    </div>
  )
}

function RecipeCard({ entry, use }: { entry: RecipeEntry; use: () => void }) {
  const { t, lang, setMethod, setRoast, setBrewer } = useStore()
  const { slug } = usePick()
  const [open, setOpen] = useState(false)
  const cur = latestVersion(entry)
  const older = entry.versions.slice(0, -1).reverse()
  const selected = slug === entry.slug

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <Display className="text-[26px] tracking-wide">{entry.brewer ? t(`brewer.${entry.brewer}`) : t(`method.${entry.method}`)}</Display>
        <span className="whitespace-nowrap text-xs text-muted">
          {t('recipes.version', { n: cur.version, date: fmtDate(cur.publishedAt, lang) })}
        </span>
      </div>
      <VersionLine v={cur} method={entry.method} className="mt-2 text-[17px] font-semibold" />
      {entry.brewer && (
        <div className="mt-3">
          <RecipeSteps recipe={cur} brewer={entry.brewer} />
        </div>
      )}

      {older.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex h-11 items-center text-sm font-semibold underline underline-offset-4"
          >
            {t(open ? 'recipes.hideHistory' : 'recipes.history', { n: older.length })}
          </button>
          {open && (
            <ul className="flex flex-col gap-2 border-t border-line pt-2">
              {older.map((v) => (
                <li key={v.id} className="text-sm">
                  <div className="text-xs text-muted">{t('recipes.version', { n: v.version, date: fmtDate(v.publishedAt, lang) })}</div>
                  <VersionLine v={v} method={entry.method} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected ? (
          <div className="mt-3 flex h-11 items-center text-[15px] font-semibold text-olive-soft">{t('recipes.inUse')}</div>
        ) : (
          <SmallButton
            onClick={() => {
              setMethod(entry.method)
              if (entry.brewer) setBrewer(entry.brewer)
              else if (entry.roast) setRoast(entry.roast)
              use()
            }}
          >
            {t('recipes.use')}
          </SmallButton>
        )}
    </Card>
  )
}

function VersionLine({ v, method, className = '' }: { v: RecipeVersion; method: RecipeEntry['method']; className?: string }) {
  const { t } = useStore()
  const parts = [`${fmtNum(v.dose)} g → ${fmtNum(v.yield)} g`, t('orders.ratio', { r: ratio(v) }), fmtRange(v.time, method), `${v.temp[0]}–${v.temp[1]} °C`]
  // each value stays on one line; the row wraps between them
  return (
    <p className={className}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className="whitespace-nowrap">
            {i > 0 && '· '}
            {p}
          </span>
        </Fragment>
      ))}
    </p>
  )
}
