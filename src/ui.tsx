import type { ReactNode } from 'react'
import type { Brew, Lang, Method, Recipe } from './data'
import type { Key } from './i18n'

export function Chevrons({ n, size = 22, color = 'currentColor' }: { n: number; size?: number; color?: string }) {
  const h = 8 * n + 2
  return (
    <svg width={size} height={(size * h) / 20} viewBox={`0 0 20 ${h}`} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M2 ${8 * i + 7} L10 ${8 * i + 2} L18 ${8 * i + 7}`} />
      ))}
    </svg>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border-2 border-ink bg-cream p-4 ${className}`}>{children}</div>
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{children}</div>
}

export function Display({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`font-display font-extrabold uppercase leading-none ${className}`}>{children}</div>
}

// A compact secondary action inside a card ("Use this recipe"); 44px tall for touch
export function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex h-11 items-center rounded-xl border-2 border-ink bg-cream px-4 text-[15px] font-semibold text-ink active:scale-[0.98]"
    >
      {children}
    </button>
  )
}

export function ScreenTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <Display className="text-[40px] tracking-wide">{title}</Display>
      <p className="mt-1 text-[15px] text-ink/80">{sub}</p>
    </div>
  )
}

// Above every sub-screen: back to the tab it was opened from
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="-ml-1 flex h-11 items-center gap-1 px-1 text-[15px] font-semibold text-ink">
      <span aria-hidden="true">←</span>
      {label}
    </button>
  )
}

// A tappable row in a list card (Profile): label, a short status on the right, chevron
export function RowButton({ label, value, onClick }: { label: string; value?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 border-b border-line px-1 text-left last:border-b-0"
    >
      <span className="flex-1 text-[17px] font-semibold">{label}</span>
      {value && <span className="text-sm text-muted">{value}</span>}
      <span aria-hidden="true" className="text-xl text-ink">›</span>
    </button>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
}) {
  const styles = {
    primary: 'bg-olive text-cream border-ink',
    secondary: 'bg-cream text-ink border-ink',
    ghost: 'bg-transparent text-ink border-transparent underline',
  }[variant]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-14 w-full rounded-xl border-2 font-display text-xl font-extrabold uppercase tracking-[0.08em] transition active:scale-[0.98] disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded-xl border-2 border-ink bg-cream">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`h-11 flex-1 text-[15px] font-semibold transition-colors duration-150 ${o.id === value ? 'bg-ink text-cream' : 'bg-transparent text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// compact: for long values such as a filter time range, which overflow the narrow desktop column
// A labelled native select, styled like Segmented: the phone's own picker suits a longer list.
// Groups with a label become optgroups; an unlabelled group lists its options plainly.
export function Select({
  value,
  groups,
  onChange,
  label,
}: {
  value: string
  groups: { label: string; options: { id: string; label: string }[] }[]
  onChange: (v: string) => void
  label: string
}) {
  const opts = (o: { id: string; label: string }[]) =>
    o.map((x) => (
      <option key={x.id} value={x.id}>
        {x.label}
      </option>
    ))
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-xl border-2 border-ink bg-cream pl-3 pr-10 text-[15px] font-semibold text-ink"
      >
        {groups.map((g, i) =>
          g.label ? (
            <optgroup key={i} label={g.label}>
              {opts(g.options)}
            </optgroup>
          ) : (
            opts(g.options)
          ),
        )}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink">
        ▾
      </span>
    </div>
  )
}

export function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <Card className="!p-3">
      <Label>{label}</Label>
      <Display className={`mt-1 whitespace-nowrap !normal-case tracking-wide ${compact ? 'text-[34px] lg:text-[26px]' : 'text-[34px]'}`}>{value}</Display>
    </Card>
  )
}

export function Stepper({
  label,
  value,
  step,
  min,
  max,
  display,
  onChange,
}: {
  label: string
  value: number
  step: number
  min: number
  max: number
  display: string
  onChange: (v: number) => void
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 10) / 10)))
  const btn = 'flex h-12 w-12 items-center justify-center rounded-lg border-2 border-ink bg-sage text-2xl font-bold leading-none text-ink active:scale-95'
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <div className="min-w-0">
        <Label>{label}</Label>
        <Display className="mt-1 text-[34px] !normal-case tracking-wide">{display}</Display>
      </div>
      <div className="flex gap-2">
        <button type="button" aria-label={`${label} -`} className={btn} onClick={() => set(value - step)}>
          −
        </button>
        <button type="button" aria-label={`${label} +`} className={btn} onClick={() => set(value + step)}>
          +
        </button>
      </div>
    </div>
  )
}

export const fmtTime = (sec: number, method: Method) =>
  method === 'filter' ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec} s`

export const fmtRange = (r: [number, number], method: Method) =>
  method === 'filter' ? `${fmtTime(r[0], method)}–${fmtTime(r[1], method)}` : `${r[0]}–${r[1]} s`

// publishedAt and diary days are calendar dates (YYYY-MM-DD), so format them in UTC to keep the day
export const fmtDate = (ymd: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${ymd}T00:00:00Z`),
  )

export const fmtClock = (ts: number, lang: Lang) =>
  new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts))

export const fmtNum =(n: number) => String(Math.round(n * 10) / 10)

export const ratio = (r: { dose: number; yield: number }) => fmtNum(r.yield / r.dose)

// A change between two numbers: +2 g, −3 s
export const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(n))}${unit}`

// 'other' is still on coffees saved before a process could be written out
const PROCESS_KEYS = ['washed', 'natural', 'honey', 'anaerobic', 'decaf', 'other']

type T = (key: Key, vars?: Record<string, string | number>) => string

/** "Espresso · Light", "Filter · V60"; filter reports from before brewers keep their roast. */
export const brewLabel = (t: T, b: Brew) =>
  `${t(`method.${b.method}`)} · ${b.brewer ? t(`brewer.${b.brewer}`) : b.roast ? t(`roast.${b.roast}`) : ''}`

/** A coffee's process: the usual ones translated, the player's own words as written */
export const processLabel = (t: T, p: string) => (PROCESS_KEYS.includes(p) ? t(`process.${p as 'washed'}`) : p)

// Values the diagnosis texts (d.*.change) can mention
export const diagVars = (r: Recipe, method: Method) => ({
  y: fmtNum(r.yield),
  d: fmtNum(r.dose),
  b: fmtNum(r.steps?.find((s) => s.kind === 'bloom')?.to ?? r.dose * 3),
  range: fmtRange(r.time, method),
})
