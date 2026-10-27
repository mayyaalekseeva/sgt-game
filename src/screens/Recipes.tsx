import { Fragment, useState } from 'react'
import { loadRecipes, useLoad } from '../api'
import { METHODS, ROASTS, latestVersion, type RecipeEntry, type RecipeVersion } from '../data'
import { useStore } from '../store'
import { Card, Display, Label, LinkButton, SubHeader, fmtDate, fmtNum, fmtRange, ratio } from '../ui'

// All recipes with their version history. Opened from Orders; "Use" picks it there.
export default function Recipes({ back }: { back: () => void }) {
  const { t } = useStore()
  const data = useLoad(loadRecipes)

  return (
    <div className="flex flex-col gap-4">
      <SubHeader title={t('recipes.title')} sub={t('recipes.sub')} back={t('tab.orders')} onBack={back} />
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
                    .filter((e) => e.method === m)
                    .sort((a, b) => ROASTS.indexOf(a.roast) - ROASTS.indexOf(b.roast))
                    .map((e) => (
                      <li key={e.slug}>
                        <RecipeCard entry={e} back={back} />
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

function RecipeCard({ entry, back }: { entry: RecipeEntry; back: () => void }) {
  const { t, lang, method, roast, setMethod, setRoast } = useStore()
  const [open, setOpen] = useState(false)
  const cur = latestVersion(entry)
  const older = entry.versions.slice(0, -1).reverse()
  const archived = entry.status === 'archived'
  const selected = method === entry.method && roast === entry.roast

  return (
    <Card className={archived ? 'border-locked bg-locked/40' : ''}>
      <div className="flex items-baseline justify-between gap-2">
        <Display className="text-[26px] tracking-wide">{t(`roast.${entry.roast}`)}</Display>
        <span className="whitespace-nowrap text-xs text-muted">
          {t('recipes.version', { n: cur.version, date: fmtDate(cur.publishedAt, lang) })}
        </span>
      </div>
      {archived && <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t('recipes.archived')}</div>}
      <VersionLine v={cur} method={entry.method} className="mt-2 text-[17px] font-semibold" />

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

      {!archived &&
        (selected ? (
          <div className="mt-1 flex h-11 items-center text-[15px] font-semibold text-olive-soft">{t('recipes.inUse')}</div>
        ) : (
          <LinkButton
            onClick={() => {
              setMethod(entry.method)
              setRoast(entry.roast)
              back()
            }}
          >
            {t('recipes.use')}
          </LinkButton>
        ))}
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
