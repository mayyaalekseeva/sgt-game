import { useState } from 'react'
import { FAMILIES, MAX_FLAVORS, familyOf, isKnownFlavor, pickFamily, toggleFlavor } from '../flavors'
import type { Key } from '../i18n'
import { useStore } from '../store'
import { Label } from '../ui'

const chip = 'min-h-11 rounded-full border-2 px-3 text-[15px] font-semibold transition-colors duration-150 active:scale-[0.98] disabled:opacity-40'
const isOff = (id: string) => familyOf(id) === 'off'
const tone = (id: string, on: boolean) =>
  on ? 'border-ink bg-ink text-cream' : isOff(id) ? 'border-terracotta bg-cream text-terracotta' : 'border-ink bg-cream text-ink'

// What the player tasted, for Diagnose and the Diary's edit form. Ids this build does not list (a newer one added
// them) are not shown but stay in the value, so saving does not drop them.
export default function FlavorPicker({ value, onChange, gap = 'gap-2' }: { value: string[]; onChange: (v: string[]) => void; gap?: string }) {
  const { t } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const full = value.length >= MAX_FLAVORS
  const family = FAMILIES.find((f) => f.id === open)
  const picked = value.filter(isKnownFlavor)
  return (
    <div className={`flex flex-col ${gap}`}>
      <div className="flex items-baseline justify-between gap-2">
        <Label>{t('diag.flavors')}</Label>
        {value.length > 0 && <span className="text-xs font-semibold text-muted">{t('flavor.count', { n: value.length, max: MAX_FLAVORS })}</span>}
      </div>
      {picked.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {picked.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={t('flavor.remove', { f: t(`flavor.${id}` as Key) })}
              onClick={() => onChange(value.filter((x) => x !== id))}
              className={`${chip} flex items-center gap-1.5 ${tone(id, true)}`}
            >
              {t(`flavor.${id}` as Key)}
              <span aria-hidden="true" className="text-cream/70">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink/70">{t('diag.flavorsHint')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {FAMILIES.map((f) => {
          const has = value.some((id) => familyOf(id) === f.id)
          return (
            <button
              key={f.id}
              type="button"
              aria-expanded={open === f.id}
              disabled={full && !has}
              onClick={() => {
                if (open === f.id) return setOpen(null)
                setOpen(f.id)
                onChange(pickFamily(value, f.id))
              }}
              className={`${chip} ${has ? (isOff(f.id) ? 'border-terracotta bg-terracotta/10 text-terracotta' : 'border-ink bg-line text-ink') : tone(f.id, false)} ${open === f.id ? 'underline underline-offset-4' : ''}`}
            >
              {t(`flavor.${f.id}` as Key)}
            </button>
          )
        })}
      </div>
      {family && (
        <div className="flex flex-wrap gap-2 rounded-xl bg-line/60 p-2">
          {family.specifics.map((s) => {
            const id = `${family.id}.${s}`
            const on = value.includes(id)
            // a specific may take its bare family's place even when the list is full
            const blocked = full && !on && !value.includes(family.id)
            return (
              <button key={id} type="button" aria-pressed={on} disabled={blocked} onClick={() => onChange(toggleFlavor(value, id))} className={`${chip} ${tone(id, on)}`}>
                {t(`flavor.${id}` as Key)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Flavors as small chips; the ones in `shared` (src/flavors.ts sharedFlavors) are marked. Unknown ids are skipped. */
export function FlavorChips({ ids, shared = [] }: { ids: string[]; shared?: string[] }) {
  const { t } = useStore()
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ids.filter(isKnownFlavor).map((id) => (
        <li
          key={id}
          className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
            shared.includes(id) ? 'bg-olive text-cream' : isOff(id) ? 'border border-terracotta text-terracotta' : 'border border-ink text-ink'
          }`}
        >
          {t(`flavor.${id}` as Key)}
        </li>
      ))}
    </ul>
  )
}
