import { useState } from 'react'
import { FAMILIES, MAX_FLAVORS, familyOf, isKnownFlavor, toggleFlavor, type Family } from '../flavors'
import type { Key } from '../i18n'
import { useStore } from '../store'
import { Label } from '../ui'

const chip = 'min-h-11 rounded-full border-2 px-3 text-[15px] font-semibold transition-colors duration-150 active:scale-[0.98] disabled:opacity-40'
const isOff = (id: string) => familyOf(id) === 'off'
const tone = (id: string, on: boolean) =>
  on ? 'border-ink bg-ink text-cream' : isOff(id) ? 'border-terracotta bg-cream text-terracotta' : 'border-ink bg-cream text-ink'

// What the player tasted, for Diagnose and the Diary's edit form: one row per family, opened to pick its flavors.
// Off-notes come last, apart. Ids this build does not list (a newer one added them) are not shown but stay in the
// value, so saving does not drop them.
export default function FlavorPicker({ value, onChange, gap = 'gap-2' }: { value: string[]; onChange: (v: string[]) => void; gap?: string }) {
  const { t } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const row = (f: Family) => (
    <FamilyRow key={f.id} family={f} value={value} onChange={onChange} open={open === f.id} toggle={() => setOpen(open === f.id ? null : f.id)} />
  )
  return (
    <div className={`flex flex-col ${gap}`}>
      <div className="flex items-baseline justify-between gap-2">
        <Label>{t('diag.flavors')}</Label>
        {value.length > 0 && <span className="text-xs font-semibold text-muted">{t('flavor.count', { n: value.length, max: MAX_FLAVORS })}</span>}
      </div>
      <p className="text-sm text-ink/70">{t('diag.flavorsHint')}</p>
      <div className="flex flex-col">
        {FAMILIES.filter((f) => !f.off).map(row)}
        <div className="mt-2 border-t-2 border-ink/20 pt-1">{FAMILIES.filter((f) => f.off).map(row)}</div>
      </div>
    </div>
  )
}

function FamilyRow({ family, value, onChange, open, toggle }: { family: Family; value: string[]; onChange: (v: string[]) => void; open: boolean; toggle: () => void }) {
  const { t } = useStore()
  const picked = value.filter((id) => familyOf(id) === family.id && isKnownFlavor(id))
  const full = value.length >= MAX_FLAVORS
  // a report from before specifics-only may hold the bare family; it shows so it can be removed or narrowed down
  const ids = [...(value.includes(family.id) ? [family.id] : []), ...family.specifics.map((s) => `${family.id}.${s}`)]
  return (
    <div className="border-b border-line last:border-b-0">
      <button type="button" aria-expanded={open} onClick={toggle} className="flex min-h-11 w-full items-center gap-3 py-1 text-left">
        <span className={`flex-none text-[15px] font-semibold ${family.off ? 'text-terracotta' : 'text-ink'}`}>
          {t(family.off ? 'flavor.offRow' : (`flavor.${family.id}` as Key))}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-sm text-muted">{picked.map((id) => t(`flavor.${id}` as Key)).join(', ')}</span>
        <span aria-hidden="true" className={`flex-none text-ink transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 pb-3">
          {ids.map((id) => {
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
