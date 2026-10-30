import { GRINDER_KINDS, GRINDERS, grinderName } from '../grinders'
import { useStore } from '../store'
import { Label, Select } from '../ui'

// Which grinder, for Diagnose and the Diary's edit form. '' is not chosen.
export default function GrinderSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useStore()
  // an id this build does not list (a newer one added it) still shows, so saving does not drop it
  const unknown = value && !GRINDERS.some((g) => g.id === value) ? [{ label: '', options: [{ id: value, label: grinderName(value) }] }] : []
  return (
    <div className="flex flex-col gap-1">
      <Label>{t('diag.grinderModel')}</Label>
      <Select
        label={t('diag.grinderModel')}
        value={value}
        onChange={onChange}
        groups={[
          { label: '', options: [{ id: '', label: t('diag.grinderNone') }] },
          ...unknown,
          ...GRINDER_KINDS.map((k) => ({ label: t(`grinder.${k}`), options: GRINDERS.filter((g) => g.kind === k).map((g) => ({ id: g.id, label: g.name })) })),
        ]}
      />
    </div>
  )
}
