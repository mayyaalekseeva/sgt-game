import { useState } from 'react'
import { FAMILIES, MAX_FLAVORS, familyOf, isKnownFlavor, toggleFlavor, type Family } from '../flavors'
import type { Key } from '../i18n'
import { useStore } from '../store'
import { Label } from '../ui'

const chip = 'min-h-11 rounded-full border-2 px-3 text-[15px] font-semibold transition-colors duration-150 active:scale-[0.98] disabled:opacity-40'
const isOff = (id: string) => familyOf(id) === 'off'
const tone = (id: string, on: boolean) =>
  on ? 'border-ink bg-ink text-cream' : isOff(id) ? 'border-terracotta bg-cream text-terracotta' : 'border-ink bg-cream text-ink'
const heading = 'text-xs font-semibold uppercase tracking-[0.12em]'

// What the player tasted, for Diagnose and the Diary's edit form. Suggestions first (src/flavors.ts suggestFlavors),
// one tap each; then every flavor by family, folded away while there are suggestions; off-notes always last, apart.
// Ids this build does not list (a newer one added them) are not shown but stay in the value, so saving keeps them.
export default function FlavorPicker({
  value,
  onChange,
  suggested,
  gap = 'gap-2',
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggested: string[]
  gap?: string
}) {
  const { t } = useStore()
  const [all, setAll] = useState(suggested.length === 0)
  const chips = (ids: string[]) => <Chips ids={ids} value={value} onChange={onChange} />
  // a report from before specifics-only may hold a bare family; it shows in its group so it can be removed
  const idsOf = (f: Family) => [...(value.includes(f.id) ? [f.id] : []), ...f.specifics.map((s) => `${f.id}.${s}`)]
  const off = FAMILIES.filter((f) => f.off)
  return (
    <div className={`flex flex-col ${gap}`}>
      <div className="flex items-baseline justify-between gap-2">
        <Label>{t('diag.flavors')}</Label>
        {value.length > 0 && <span className="text-xs font-semibold text-muted">{t('flavor.count', { n: value.length, max: MAX_FLAVORS })}</span>}
      </div>
      <p className="text-sm text-ink/70">{t('diag.flavorsHint')}</p>
      {suggested.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className={`${heading} text-muted`}>{t('flavor.suggested')}</div>
          {chips(suggested)}
        </div>
      )}
      <button type="button" aria-expanded={all} onClick={() => setAll(!all)} className="flex min-h-11 items-center justify-between gap-2 border-t border-line text-left text-[15px] font-semibold text-ink">
        {t('flavor.all')}
        <span aria-hidden="true" className={`transition-transform duration-150 ${all ? 'rotate-90' : ''}`}>›</span>
      </button>
      {all &&
        FAMILIES.filter((f) => !f.off).map((f) => (
          <div key={f.id} className="flex flex-col gap-1.5">
            <div className={`${heading} text-muted`}>{t(`flavor.${f.id}` as Key)}</div>
            {chips(idsOf(f))}
          </div>
        ))}
      <div className="flex flex-col gap-1.5 border-t border-line pt-2">
        <div className={`${heading} text-terracotta`}>{t('flavor.offRow')}</div>
        {chips(off.flatMap(idsOf))}
      </div>
    </div>
  )
}

function Chips({ ids, value, onChange }: { ids: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useStore()
  const full = value.length >= MAX_FLAVORS
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const on = value.includes(id)
        // a specific may take its bare family's place even when the list is full
        const blocked = full && !on && !value.includes(familyOf(id))
        return (
          <button key={id} type="button" aria-pressed={on} disabled={blocked} onClick={() => onChange(toggleFlavor(value, id))} className={`${chip} ${tone(id, on)}`}>
            {t(`flavor.${id}` as Key)}
          </button>
        )
      })}
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
