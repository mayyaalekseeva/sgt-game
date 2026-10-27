import { STYLE_OF, type Brewer, type Recipe } from '../data'
import { useStore } from '../store'
import { Label, fmtRange, fmtTime } from '../ui'

// A brewer recipe as a timeline: grind, then each step at its time, then when the brew should be done
export default function RecipeSteps({ recipe, brewer }: { recipe: Recipe; brewer: Brewer }) {
  const { t } = useStore()
  if (!recipe.grind || !recipe.steps) return null
  return (
    <div>
      <Label>
        {t('recipe.grind')}: {t(`grind.${recipe.grind}`)}
      </Label>
      <ol className="mt-2 flex flex-col">
        {recipe.steps.map((s, i) => (
          <li key={i} className="flex gap-3 border-b border-line py-2 text-[15px] last:border-b-0">
            <span className="w-12 flex-none font-semibold tabular-nums">{fmtTime(s.at, 'filter')}</span>
            <span>{t(`step.${s.kind}`, { to: s.to ?? 0 })}</span>
          </li>
        ))}
        <li className="flex gap-3 py-2 text-[15px] font-semibold">
          <span className="w-12 flex-none" aria-hidden="true">
            ✓
          </span>
          <span>{t(`step.end.${STYLE_OF[brewer]}`, { range: fmtRange(recipe.time, 'filter') })}</span>
        </li>
      </ol>
    </div>
  )
}
