import { METHODS, ROASTS } from '../data'
import { useStore } from '../store'
import { Segmented } from '../ui'

export default function RecipePicker() {
  const { t, method, roast, setMethod, setRoast } = useStore()
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        label={t('label.method')}
        value={method}
        onChange={setMethod}
        options={METHODS.map((m) => ({ id: m, label: t(`method.${m}`) }))}
      />
      <Segmented
        label={t('label.roast')}
        value={roast}
        onChange={setRoast}
        options={ROASTS.map((r) => ({ id: r, label: t(`roast.${r}`) }))}
      />
    </div>
  )
}
