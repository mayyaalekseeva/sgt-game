import { useId, useState } from 'react'
import { searchOrigins } from '../origins'
import { useStore } from '../store'
import { Label, field } from '../ui'

// A search box over coffee origins: type, then pick from the list. Only a listed origin counts as chosen.
export default function OriginPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t, lang } = useStore()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const id = useId()
  const matches = searchOrigins(query === value ? '' : query, lang)

  const choose = (name: string) => {
    onChange(name)
    setQuery(name)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <Label>{t('coffee.origin')}</Label>
      <div className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
        aria-autocomplete="list"
        aria-label={t('coffee.origin')}
        placeholder={t('coffee.originSearch')}
        value={query}
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        // let a tap on the list land before it closes; a half-typed name falls back to the chosen one
        onBlur={() =>
          setTimeout(() => {
            setOpen(false)
            setQuery((q) => (matches.includes(q) ? q : value))
          }, 120)
        }
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(0)
          if (value) onChange('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && open && matches[active]) {
            e.preventDefault()
            choose(matches[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className={`h-11 w-full ${field} font-semibold placeholder:font-normal`}
      />
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border-2 border-ink bg-cream py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{t('coffee.originNone')}</li>
          ) : (
            matches.map((m, i) => (
              <li
                key={m}
                id={`${id}-${i}`}
                role="option"
                aria-selected={m === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(m)}
                className={`flex min-h-11 cursor-pointer items-center px-3 text-[15px] ${i === active ? 'bg-sage/40' : ''} ${m === value ? 'font-semibold' : ''}`}
              >
                {m}
              </li>
            ))
          )}
        </ul>
      )}
      </div>
      <span className="text-xs text-muted">{t('coffee.originHint')}</span>
    </div>
  )
}
