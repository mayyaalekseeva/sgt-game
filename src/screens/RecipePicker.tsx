import { BREWERS, METHODS, ROASTS } from '../data'
import { currentLots } from '../lots'
import { useStore } from '../store'
import { Segmented, Select } from '../ui'

// The coffee, then the method; espresso is picked by roast level, filter by brewer
export default function RecipePicker() {
  const { t, lang, lot, method, roast, brewer, setLot, setMethod, setRoast, setBrewer } = useStore()
  return (
    <div className="flex flex-col gap-2">
      <Select
        label={t('label.lot')}
        value={lot ?? ''}
        onChange={(v) => setLot(v || null)}
        options={[
          ...currentLots().map((l) => ({ id: l.slug, label: `${l.name} · ${l.country[lang]}` })),
          { id: '', label: t('lot.other') },
        ]}
      />
      <Segmented
        label={t('label.method')}
        value={method}
        onChange={setMethod}
        options={METHODS.map((m) => ({ id: m, label: t(`method.${m}`) }))}
      />
      {method === 'espresso' ? (
        <Segmented
          label={t('label.roast')}
          value={roast}
          onChange={setRoast}
          options={ROASTS.map((r) => ({ id: r, label: t(`roast.${r}`) }))}
        />
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
