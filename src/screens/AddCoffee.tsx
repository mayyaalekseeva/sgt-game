import { useState } from 'react'
import { MAX_TEXT, PROCESSES, myRef, type Process } from '../coffees'
import { ROASTS, localDay, type Roast } from '../data'
import { useReports } from '../reports'
import { useStore } from '../store'
import { newReportId } from '../sync'
import { Button, Card, Label, ScreenTitle, Segmented, Select } from '../ui'

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <Label>{label}</Label>
      <input
        value={value}
        maxLength={MAX_TEXT}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border-2 border-ink bg-cream px-3 text-[16px] font-semibold text-ink"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}

// A bag from any roaster. Once saved it is picked like a lot and gets its own working recipes.
export default function AddCoffee({ done }: { done: () => void }) {
  const { t, setLot } = useStore()
  const { saveCoffee } = useReports()
  const [roaster, setRoaster] = useState('')
  const [origin, setOrigin] = useState('')
  const [process, setProcess] = useState<Process | ''>('')
  const [roast, setRoast] = useState<Roast | ''>('')
  const [name, setName] = useState('')
  const [roastedOn, setRoastedOn] = useState('')
  const ready = roaster.trim() !== '' && origin.trim() !== '' && process !== '' && roast !== ''

  const save = () => {
    if (!ready) return
    const id = newReportId()
    saveCoffee({
      id,
      roaster: roaster.trim(),
      origin: origin.trim(),
      process,
      roast,
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(roastedOn ? { roastedOn } : {}),
      updatedAt: Date.now(),
    })
    setLot(myRef(id))
    done()
  }

  return (
    <div className="flex flex-col gap-4 lg:max-w-xl">
      <ScreenTitle title={t('coffee.addTitle')} sub={t('coffee.addSub')} />
      <Card className="flex flex-col gap-4">
        <Field label={t('coffee.roaster')} value={roaster} onChange={setRoaster} />
        <Field label={t('coffee.origin')} value={origin} onChange={setOrigin} hint={t('coffee.originHint')} />
        <div className="flex flex-col gap-1">
          <Label>{t('coffee.process')}</Label>
          <Select
            label={t('coffee.process')}
            value={process}
            onChange={(v) => setProcess(v as Process)}
            groups={[{ label: '', options: [{ id: '', label: t('coffee.choose') }, ...PROCESSES.map((p) => ({ id: p, label: t(`process.${p}`) }))] }]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t('label.roast')}</Label>
          <Segmented label={t('label.roast')} value={roast} onChange={setRoast} options={ROASTS.map((r) => ({ id: r, label: t(`roast.${r}`) }))} />
        </div>
        <Field label={t('coffee.name')} value={name} onChange={setName} hint={t('coffee.nameHint')} />
        <label className="flex flex-col gap-1">
          <Label>{t('coffee.roastedOn')}</Label>
          <input
            type="date"
            value={roastedOn}
            max={localDay(Date.now())}
            onChange={(e) => setRoastedOn(e.target.value)}
            className="h-11 rounded-xl border-2 border-ink bg-cream px-3 text-[16px] font-semibold text-ink"
          />
          <span className="text-xs text-muted">{t('coffee.roastedOnHint')}</span>
        </label>
      </Card>
      <Button disabled={!ready} onClick={save}>
        {t('coffee.save')}
      </Button>
    </div>
  )
}
