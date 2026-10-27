import { BREWERS, METHODS, ROASTS } from '../data'
import { useStore } from '../store'
import { Segmented } from '../ui'

// Espresso is picked by roast level; filter by brewer, since its roast comes with the coffee
export default function RecipePicker() {
  const { t, method, roast, brewer, setMethod, setRoast, setBrewer } = useStore()
  return (
    <div className="flex flex-col gap-2">
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
