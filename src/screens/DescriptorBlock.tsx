import { useState } from 'react'
import {
  MAX_ATTR_NOTE,
  MAX_TAGS,
  SIMPLE_DESCRIPTORS,
  chainOf,
  childrenOf,
  isKnownTag,
  kindOf,
  tagLabelKey,
  toggleTag,
  type AttrDetail,
} from '../cupping-descriptors'
import { familyOf } from '../flavors'
import type { Key } from '../i18n'
import { useStore } from '../store'
import { field } from '../ui'

// Under each cupping attribute: quick buttons for what you notice, then a short note, so nothing is typed on a phone
// keyboard unless you want to. Fragrance/aroma, flavor and aftertaste open the flavor wheel one tier at a time (a family,
// then a finer one, then a finer one still); the other attributes show a short list. Closed, it is one line with what
// was picked. src/cupping-descriptors.ts holds the lists and the rules.

const chip = 'min-h-11 rounded-full px-3.5 text-[15px] font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-40'
const heading = 'text-xs font-semibold uppercase tracking-[0.12em] text-muted'

export default function DescriptorBlock({
  attr,
  label,
  detail,
  onChange,
  defaultOpen = false,
}: {
  attr: string
  label: string // the attribute's name, for the screen reader
  detail: AttrDetail | undefined
  onChange: (change: AttrDetail) => void
  defaultOpen?: boolean
}) {
  const { t } = useStore()
  const kind = kindOf(attr)
  const tags = (detail?.tags ?? []).filter((id) => isKnownTag(attr, id))
  const [open, setOpen] = useState(defaultOpen || !!detail?.note || tags.length > 0)
  const name = (id: string) => t(tagLabelKey(attr, id) as Key)
  // keep tags this build does not list (a newer one added them) when picking, so syncing does not drop them
  const unknown = (detail?.tags ?? []).filter((id) => !isKnownTag(attr, id))
  const setTags = (picked: string[]) => onChange({ tags: [...picked, ...unknown].slice(0, MAX_TAGS) })

  if (kind === 'none') return null

  if (!open) {
    const summary = [tags.map(name).join(', '), detail?.note].filter(Boolean).join(' · ')
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-label={`${label}: ${t('cupping.detail.open')}`}
        onClick={() => setOpen(true)}
        className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg bg-line/50 px-3 text-left text-[15px] text-ink"
      >
        <span className={`min-w-0 flex-1 truncate ${summary ? 'font-medium' : 'text-muted'}`}>{summary || t('cupping.detail.open')}</span>
        <span aria-hidden="true" className="text-lg leading-none">
          +
        </span>
      </button>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg bg-line/30 p-3">
      {tags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className={heading}>{t('cupping.detail.open')}</span>
            <span className="text-xs font-semibold text-muted">{t('cupping.detail.count', { n: tags.length, max: MAX_TAGS })}</span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  aria-label={t('cupping.detail.remove', { f: name(id) })}
                  onClick={() => setTags(tags.filter((x) => x !== id))}
                  className={`${chip} flex items-center gap-1.5 bg-ink text-cream`}
                >
                  {name(id)}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {kind === 'wheel' ? (
        <Wheel tags={tags} onChange={setTags} name={name} />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(SIMPLE_DESCRIPTORS[attr] ?? []).map((id) => {
            const on = tags.includes(id)
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                disabled={!on && tags.length >= MAX_TAGS}
                onClick={() => setTags(toggleTag(tags, id))}
                className={`${chip} ${on ? 'bg-ink text-cream' : 'bg-line/70 text-ink'}`}
              >
                {name(id)}
              </button>
            )
          })}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className={heading}>{t('cupping.detail.note')}</span>
        <textarea
          value={detail?.note ?? ''}
          maxLength={MAX_ATTR_NOTE}
          rows={2}
          aria-label={`${label}: ${t('cupping.detail.note')}`}
          placeholder={t('cupping.detail.noteHint')}
          onChange={(e) => onChange({ note: e.target.value || undefined })}
          className={`${field} resize-none bg-cream py-2`}
        />
      </label>

      {!defaultOpen && (
        <button type="button" aria-expanded={true} onClick={() => setOpen(false)} className="flex min-h-11 min-w-11 items-center self-start text-sm font-semibold text-muted">
          {t('cupping.detail.hide')}
        </button>
      )}
    </div>
  )
}

// The flavor wheel, a tier at a time. `chain` is the path that is open ("fruity", then "fruity.berry"); each tier of it shows
// its children under the one before. A tap picks the tag and opens what is under it; a second tap on a picked one drops it
// and closes it again.
function Wheel({ tags, onChange, name }: { tags: string[]; onChange: (v: string[]) => void; name: (id: string) => string }) {
  const { t } = useStore()
  const [chain, setChain] = useState<string[]>(() => {
    const last = tags[tags.length - 1]
    return last ? chainOf(last).filter((id) => childrenOf(id).length > 0) : []
  })
  const rows = ['', ...chain].map((parent) => ({ parent, ids: childrenOf(parent) })).filter((r) => r.ids.length > 0)
  const picked = (id: string) => tags.includes(id)
  const below = (id: string) => tags.some((x) => x.startsWith(`${id}.`))

  const tap = (id: string) => {
    const was = picked(id)
    onChange(toggleTag(tags, id))
    const path = chainOf(id)
    // a tag with finer ones under it opens them; closing a picked one, or tapping one with nothing under it, stays on its tier
    const opens = !was && childrenOf(id).length > 0
    setChain(opens ? path : path.slice(0, -1))
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map(({ parent, ids }) => (
        <div key={parent || 'top'} className="flex flex-col gap-1.5">
          {parent !== '' && (
            <div className={heading}>
              {name(parent)} · {t('cupping.detail.finer')}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {ids.map((id) => {
              const on = picked(id)
              const inPath = chain.includes(id) || below(id)
              const off = familyOf(id) === 'off'
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  aria-expanded={childrenOf(id).length > 0 ? chain.includes(id) : undefined}
                  disabled={!on && !inPath && tags.length >= MAX_TAGS && !tags.some((x) => id.startsWith(`${x}.`))}
                  onClick={() => tap(id)}
                  className={`${chip} ${
                    on ? 'bg-ink text-cream' : inPath ? 'border-2 border-olive bg-line/70 text-ink' : off ? 'bg-terracotta/10 text-terracotta' : 'bg-line/70 text-ink'
                  }`}
                >
                  {name(id)}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
