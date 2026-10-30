import { useState } from 'react'
import { RECIPES } from '../data'
import { DRILLS, QUIZ_XP, shotAnswer, shotOptions, type ArtId, type DrillDef, type Question } from '../drills'
import type { Key } from '../i18n'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Button, Card, Chevrons, Display, Label, diagVars } from '../ui'
import DrillArt from './DrillArt'

type T = ReturnType<typeof useStore>['t']

const ART_LABELS: Record<ArtId, Key[]> = {
  extraction: ['art.sour', 'art.sweet', 'art.bitter', 'art.stop'],
  grind: ['art.fine', 'art.coarse'],
  ratio: ['art.r15', 'art.r2', 'art.r25', 'art.sameDose'],
  puck: ['art.channel'],
}

// A question as the screen shows it: the prompt lines, the options, which one is right and why
function asked(t: T, q: Question) {
  if (q.kind === 'pick') {
    return {
      lines: [t(`drill.q.${q.id}.q` as Key)],
      options: Array.from({ length: q.options }, (_, i) => t(`drill.q.${q.id}.o${i}` as Key)),
      answer: q.answer,
      why: t(`drill.q.${q.id}.why` as Key),
    }
  }
  const r = RECIPES[q.slug]
  const vars = diagVars(r, 'espresso')
  const options = shotOptions(q)
  const right = shotAnswer(q)
  return {
    lines: [
      t('drill.shot.recipe', { dose: r.dose, yield: r.yield, time: `${r.time[0]}–${r.time[1]}` }),
      t('drill.shot.cup', { yield: q.yield ?? r.yield, time: q.time, taste: t(`taste.${q.taste}`).toLowerCase() }),
      t('drill.shot.q'),
    ],
    options: options.map((id) => t(`d.${id}.change` as Key, vars)),
    answer: options.indexOf(right),
    why: t(`d.${right}.why` as Key, vars),
  }
}

// One drill: the briefing cards, then the field test, then what it earned and the field assignment
export default function Drill({ drill, open }: { drill: DrillDef; open: (id: string | null) => void }) {
  const { t } = useStore()
  const { drills, passDrill } = useReports()
  const state = drills.find((d) => d.id === drill.id)!
  const [phase, setPhase] = useState<'brief' | 'test' | 'done'>('brief')
  const [card, setCard] = useState(0)
  const [qi, setQi] = useState(0)
  const [wrong, setWrong] = useState<number[]>([])
  const [right, setRight] = useState(false)
  // whether this run passed the field test for the first time, for the +XP line
  const [firstPass, setFirstPass] = useState(false)

  const at = DRILLS.findIndex((d) => d.id === drill.id)
  const next = DRILLS[at + 1]

  const header = (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{String(at + 1).padStart(2, '0')} · {t('drills.title')}</div>
      <Display className="text-[40px] tracking-wide">{t(`drill.${drill.id}.t` as Key)}</Display>
      <p className="mt-1 text-[15px] text-ink/80">{t(`drill.${drill.id}.sub` as Key)}</p>
    </div>
  )

  if (phase === 'brief') {
    const art = drill.art[card]
    const last = card === drill.art.length - 1
    return (
      <div className="flex flex-col gap-4 lg:max-w-2xl">
        {header}
        <Card key={card} className="animate-enter">
          <Label>{t('drill.card', { n: card + 1, total: drill.art.length })}</Label>
          {art && (
            <div className="mt-3">
              <DrillArt id={art} labels={ART_LABELS[art].map((k) => t(k))} />
            </div>
          )}
          <Display className="mt-3 text-[26px] tracking-wide">{t(`drill.${drill.id}.c${card}.t` as Key)}</Display>
          <p className="mt-2 text-[17px] leading-relaxed">{t(`drill.${drill.id}.c${card}.b` as Key)}</p>
        </Card>
        <div className="flex gap-2" aria-hidden="true">
          {drill.art.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded ${i <= card ? 'bg-olive' : 'bg-line'}`} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={card === 0} onClick={() => setCard(card - 1)}>
            {t('drill.back')}
          </Button>
          {last ? (
            <Button
              onClick={() => {
                setPhase('test')
                setQi(0)
                setWrong([])
                setRight(false)
              }}
            >
              {t('drills.quiz')}
            </Button>
          ) : (
            <Button onClick={() => setCard(card + 1)}>{t('drill.next')}</Button>
          )}
        </div>
        <p className="text-xs text-muted">{t('dos.draft')}</p>
      </div>
    )
  }

  if (phase === 'test') {
    const q = asked(t, drill.quiz[qi])
    const last = qi === drill.quiz.length - 1
    const pick = (i: number) => {
      if (right || wrong.includes(i)) return
      if (i === q.answer) setRight(true)
      else setWrong([...wrong, i])
    }
    const advance = () => {
      if (!last) {
        setQi(qi + 1)
        setWrong([])
        setRight(false)
        return
      }
      setFirstPass(!state.quizPassed)
      passDrill(drill.id)
      setPhase('done')
    }
    return (
      <div className="flex flex-col gap-4 lg:max-w-2xl">
        {header}
        <Card key={qi} className="animate-enter">
          <Label>{t('drill.question', { n: qi + 1, total: drill.quiz.length })}</Label>
          <div className="mt-2 flex flex-col gap-1">
            {q.lines.map((line, i) => (
              <p key={i} className={i === q.lines.length - 1 ? 'text-[19px] font-semibold leading-snug' : 'text-[16px] leading-snug'}>
                {line}
              </p>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {q.options.map((o, i) => {
              const isRight = right && i === q.answer
              const isWrong = wrong.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={isRight || isWrong}
                  disabled={isWrong || (right && !isRight)}
                  onClick={() => pick(i)}
                  className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-2 text-left text-[16px] font-semibold transition-colors duration-150 active:scale-[0.99] ${
                    isRight ? 'border-ink bg-olive text-cream' : isWrong ? 'border-line bg-cream text-muted line-through' : 'border-ink bg-cream text-ink disabled:opacity-50'
                  }`}
                >
                  <span className="flex-1">{o}</span>
                  {isRight && <span aria-hidden="true">✓</span>}
                  {isWrong && <span aria-hidden="true">✗</span>}
                </button>
              )
            })}
          </div>
          <div aria-live="polite">
            {right ? (
              <div className="mt-4 animate-enter border-t border-line pt-3">
                <Display className="text-[22px] tracking-wide text-olive">{t('drill.right')}</Display>
                <p className="mt-1 text-[16px] leading-snug">{q.why}</p>
              </div>
            ) : (
              wrong.length > 0 && <p className="mt-3 text-[15px] leading-snug text-ink/80">{t('drill.wrong')}</p>
            )}
          </div>
        </Card>
        {right && <Button onClick={advance}>{last ? t('drill.finish') : t('drill.continue')}</Button>}
      </div>
    )
  }

  const nextState = next ? drills.find((d) => d.id === next.id) : undefined
  return (
    <div className="flex flex-col gap-4 lg:max-w-2xl">
      {header}
      <div className="flex animate-stamp items-center gap-3 rounded-2xl border-2 border-ink bg-olive p-4 text-cream">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-cream text-olive">
          <Chevrons n={1} size={22} />
        </div>
        <Display className="text-[24px] tracking-wide">
          {firstPass ? t('drill.passed', { xp: QUIZ_XP }) : t('drill.passedBefore')}
        </Display>
      </div>
      <TaskCard drill={drill} />
      {nextState?.unlocked && <Button onClick={() => open(next.id)}>{t('drills.next', { d: t(`drill.${next.id}.t` as Key) })}</Button>}
      <Button variant={nextState?.unlocked ? 'secondary' : 'primary'} onClick={() => open(null)}>
        {t('drill.all')}
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          setCard(0)
          setPhase('brief')
        }}
      >
        {t('drill.again')}
      </Button>
    </div>
  )
}

function TaskCard({ drill }: { drill: DrillDef }) {
  const { t } = useStore()
  const { drills } = useReports()
  const a = drills.find((d) => d.id === drill.id)?.assignment
  return (
    <Card>
      <Label>{t('drill.task')}</Label>
      {a ? (
        <>
          <p className="mt-1 text-[17px] font-semibold leading-snug">{t(`drill.${drill.id}.task` as Key)}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 rounded bg-line">
              <div className="h-2 origin-left animate-grow rounded bg-olive-soft" style={{ width: `${(a.cur / a.goal) * 100}%` }} />
            </div>
            <span className="text-xs text-muted">{a.cur}/{a.goal}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-olive-soft">
            {a.done ? `✓ ${t('drills.taskDone')}` : t('drill.taskXp', { xp: a.xp })}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[16px] leading-snug">{t('drill.noTask')}</p>
      )}
    </Card>
  )
}
