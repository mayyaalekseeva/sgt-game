import { myRef } from '../coffees'
import { BREWERS, METHODS } from '../data'
import { currentLots } from '../lots'
import { usePick, useReports } from '../reports'
import { useStore } from '../store'
import { Segmented, Select } from '../ui'

const ADD = '__add'

// The coffee, then the method. Espresso of your own coffee shows its roast; a roaster lot brews the medium
// recipe (LOT_ROAST). Filter is picked by brewer. Every brew is of a known coffee: a roaster lot or one you added.
export default function RecipePicker({ addCoffee }: { addCoffee: () => void }) {
  const { t, lang, method, brewer, setLot, setMethod, setBrewer } = useStore()
  const { coffees } = useReports()
  const { lot, mine } = usePick()
  const yours = coffees.filter((c) => !c.archived || myRef(c.id) === lot)

  return (
    <div className="flex flex-col gap-2">
      <Select
        label={t('label.lot')}
        value={lot}
        onChange={(v) => (v === ADD ? addCoffee() : setLot(v))}
        groups={[
          { label: t('lot.roaster'), options: currentLots().map((l) => ({ id: l.slug, label: `${l.name} · ${l.country[lang]}` })) },
          ...(yours.length
            ? [{ label: t('coffee.mine'), options: yours.map((c) => ({ id: myRef(c.id), label: c.name ?? `${c.roaster} · ${c.origin}` })) }]
            : []),
          { label: '', options: [{ id: ADD, label: t('coffee.add') }] },
        ]}
      />
      <Segmented
        label={t('label.method')}
        value={method}
        onChange={setMethod}
        options={METHODS.map((m) => ({ id: m, label: t(`method.${m}`) }))}
      />
      {/* a roaster lot has no roast to pick until the roaster says it (LOT_ROAST) */}
      {method === 'espresso' ? (
        mine && (
          <p className="flex h-11 items-center rounded-xl border-2 border-dashed border-ink/40 px-3 text-[15px]">
            {t('coffee.roastFromBag', { roast: t(`roast.${mine.roast}`) })}
          </p>
        )
      ) : (
        <Segmented
          label={t('label.brewer')}
          value={brewer}
          onChange={setBrewer}
          options={BREWERS.map((b) => ({ id: b, label: t(`brewer.${b}`) }))}
        />
      )}
    </div>
  )
}
