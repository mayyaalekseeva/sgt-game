import type { ReactNode } from 'react'
import type { Lang, Method, Recipe } from './data'

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

// Inline navigation to a sub-screen; 44px tall for touch
export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-1 flex h-11 items-center gap-1 text-[15px] font-semibold text-ink underline underline-offset-4">
      {children}
      <span aria-hidden="true">→</span>
    </button>
  )
}

// Title row for sub-screens (Recipes, Diary) with a way back to the tab they were opened from
export function SubHeader({ title, sub, back, onBack }: { title: string; sub: string; back: string; onBack: () => void }) {
  return (
    <div>
      <button type="button" onClick={onBack} className="-ml-1 flex h-11 items-center gap-1 px-1 text-[15px] font-semibold text-ink">
        <span aria-hidden="true">←</span>
        {back}
      </button>
      <Display className="text-[40px] tracking-wide">{title}</Display>
      <p className="mt-1 text-[15px] text-ink/80">{sub}</p>
    </div>
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
          className={`h-11 flex-1 text-[15px] font-semibold ${o.id === value ? 'bg-ink text-cream' : 'bg-transparent text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-3">
      <Label>{label}</Label>
      <Display className="mt-1 whitespace-nowrap text-[34px] !normal-case tracking-wide">{value}</Display>
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

export const ratio = (r: Recipe) => fmtNum(r.yield / r.dose)
