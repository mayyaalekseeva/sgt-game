import { useEffect, useId, useRef, useState } from 'react'
import { localDay, monthGrid, type Lang } from '../data'
import { useStore } from '../store'
import { field, fmtDate } from '../ui'

const locale = (lang: Lang) => (lang === 'pt' ? 'pt-PT' : 'en-GB')
const monthOf = (ymd: string) => ({ y: Number(ymd.slice(0, 4)), m: Number(ymd.slice(5, 7)) - 1 })
// 1 Jan 2024 was a Monday: the weekday initials, Monday first
const weekdays = (lang: Lang) =>
  Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale(lang), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))),
  )

// A date field that opens the app's own month calendar, so it looks the same on every phone and browser.
// value is YYYY-MM-DD or ''; days after max cannot be picked.
export default function DatePicker({
  label,
  value,
  onChange,
  max,
  inCard = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  max?: string
  inCard?: boolean // inside a card the calendar is filled like a field; on the page it is its own card
}) {
  const { t, lang } = useStore()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => monthOf(value || max || localDay(Date.now())))
  const box = useRef<HTMLDivElement>(null)
  const id = useId()
  const today = localDay(Date.now())

  // a tap outside or Escape closes it; on a phone the calendar can open below the fold
  useEffect(() => {
    if (!open) return
    box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const toggle = () => {
    if (!open) setView(monthOf(value || max || today))
    setOpen(!open)
  }
  const shift = (n: number) => {
    const d = new Date(Date.UTC(view.y, view.m + n, 1))
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() })
  }
  const pick = (day: string) => {
    onChange(day)
    setOpen(false)
  }

  const first = new Date(Date.UTC(view.y, view.m, 1))
  const nextFirst = new Date(Date.UTC(view.y, view.m + 1, 1)).toISOString().slice(0, 10)
  const title = new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first)
  const arrow = 'flex h-11 w-11 items-center justify-center rounded-lg text-xl font-bold text-ink active:scale-95 disabled:opacity-30'

  return (
    // scroll-mb: stop above the bottom tab bar
    <div ref={box} className="scroll-mb-24">
      <button
        type="button"
        aria-label={`${label}: ${value ? fmtDate(value, lang) : t('date.pick')}`}
        aria-expanded={open}
        aria-controls={`${id}-cal`}
        onClick={toggle}
        className={`flex h-11 w-full items-center justify-between gap-2 ${field} text-left font-semibold`}
      >
        <span className={value ? '' : 'font-normal text-muted'}>{value ? fmtDate(value, lang) : t('date.pick')}</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="2.5" y="4" width="15" height="13.5" rx="2" />
          <path d="M2.5 8.5h15M6.5 2v4M13.5 2v4" />
        </svg>
      </button>

      {open && (
        <div
          id={`${id}-cal`}
          role="group"
          aria-label={label}
          className={`mt-2 animate-enter p-2 ${inCard ? 'rounded-lg bg-line/60' : 'rounded-xl border-2 border-ink bg-cream'}`}
        >
          <div className="flex items-center justify-between">
            <button type="button" aria-label={t('date.prev')} onClick={() => shift(-1)} className={arrow}>
              ‹
            </button>
            <span aria-live="polite" className="font-semibold first-letter:uppercase">
              {title}
            </span>
            <button type="button" aria-label={t('date.next')} disabled={!!max && nextFirst > max} onClick={() => shift(1)} className={arrow}>
              ›
            </button>
          </div>

          <div className="mt-1 grid grid-cols-7 text-center">
            {weekdays(lang).map((w, i) => (
              <span key={i} aria-hidden="true" className="py-1 text-xs font-semibold uppercase text-muted">
                {w}
              </span>
            ))}
            {monthGrid(view.y, view.m).map((day, i) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  aria-label={fmtDate(day, lang)}
                  aria-pressed={day === value}
                  aria-current={day === today ? 'date' : undefined}
                  disabled={!!max && day > max}
                  onClick={() => pick(day)}
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold transition-colors duration-150 active:scale-95 disabled:font-normal disabled:text-ink/30 ${
                    day === value ? 'bg-ink text-cream' : day === today ? 'ring-2 ring-inset ring-ink' : 'text-ink'
                  }`}
                >
                  {Number(day.slice(8))}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>

          {value && (
            <div className="mt-1 flex justify-end">
              <button type="button" onClick={() => pick('')} className="h-11 px-3 text-[15px] font-semibold text-ink underline">
                {t('date.clear')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
