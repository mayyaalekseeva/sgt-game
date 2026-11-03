import { useEffect, useRef, useState } from 'react'
import { LEVELS } from '../briefing'
import type { Key } from '../i18n'
import { useStore } from '../store'
import { Button, Chevrons, Display } from '../ui'

const ORDERS = 3
// 0: the ID card, 1..ORDERS: the orders, then the level question
const QUESTION = ORDERS + 1

// First run (and Replay briefing in Profile): who the Sargento is, what the app does, and one question.
// Skip ends it at any point; nothing here asks the player to sign in.
export default function Briefing() {
  const { t, briefing, endBriefing } = useStore()
  const [step, setStep] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const next = () => setStep((s) => Math.min(QUESTION, s + 1))

  // each new step takes focus, so keyboard and screen reader users start reading from its heading
  useEffect(() => heading.current?.focus(), [step])

  const part = step === 0 ? 1 : step === QUESTION ? 3 : 2
  const order = step >= 1 && step <= ORDERS ? step : 0
  const h = 'font-display font-extrabold uppercase leading-none tracking-wide outline-none'

  return (
    <div role="dialog" aria-modal="true" aria-label={t('brief.label')} className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 pb-6 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-ink">
          <Chevrons n={part} size={18} />
          <span className="text-sm font-semibold">{t('brief.step', { n: part, total: 3 })}</span>
        </div>
        <button type="button" onClick={() => endBriefing()} className="flex h-11 min-w-11 items-center px-3 text-[15px] font-semibold text-ink underline">
          {t('brief.skip')}
        </button>
      </div>

      {/* stays mounted, so each step's text is read out as it changes */}
      <div aria-live="polite" className="mt-4 flex flex-1 flex-col">
        {step === 0 && (
          <div className="flex flex-1 flex-col items-center gap-5">
            <div className="relative inline-block animate-deal">
              <img
                src="./brand/id-card.jpg"
                alt={t('brief.cardAlt')}
                width={545}
                height={850}
                className="h-auto max-h-[50dvh] w-auto rounded-lg border-2 border-ink"
              />
              {/* over the lower lines of the card, clear of the photo */}
              <div aria-hidden="true" className="absolute bottom-[8%] right-[4%] -rotate-12">
                <div className="animate-stamp rounded-md border-4 border-terracotta bg-cream/85 px-3 py-1 font-display text-2xl font-extrabold uppercase tracking-[0.12em] text-terracotta [animation-delay:450ms]">
                  {t('brief.stamp')}
                </div>
              </div>
            </div>
            <div className="w-full animate-enter [animation-delay:250ms]">
              <h1 ref={heading} tabIndex={-1} className={`${h} text-[32px]`}>
                {t('brief.who.t')}
              </h1>
              <p className="mt-2 text-[17px] leading-snug">{t('brief.who')}</p>
            </div>
          </div>
        )}

        {order > 0 && (
          // the newest order in the same olive card as the order of the day (tapping it advances too),
          // the ones already given stay above it
          <div className="flex flex-col gap-3">
            {Array.from({ length: order - 1 }, (_, i) => (
              <div key={i} className="rounded-xl border-2 border-ink bg-cream px-4 py-3">
                <Display className="text-sm tracking-[0.14em] text-muted">{t('brief.order', { n: i + 1, total: ORDERS })}</Display>
                <p className="mt-1 text-[15px] leading-snug">{t(`brief.o${i + 1}` as Key)}</p>
              </div>
            ))}
            <div key={order} onClick={next} className="animate-step rounded-2xl border-2 border-ink bg-olive p-4 text-cream">
              <div className="flex items-center gap-3">
                <img src="./brand/sargento.jpg" alt="" className="h-12 w-12 flex-none rounded-full border-2 border-cream object-cover" />
                <h1 ref={heading} tabIndex={-1} className={`${h} text-lg tracking-[0.14em] text-cream`}>
                  {t('brief.order', { n: order, total: ORDERS })}
                </h1>
              </div>
              <p className="mt-3 text-[21px] font-medium leading-snug">{t(`brief.o${order}` as Key)}</p>
            </div>
          </div>
        )}

        {step === QUESTION && (
          <div className="animate-step">
            <h1 ref={heading} tabIndex={-1} className={`${h} text-[32px]`}>
              {t('brief.q')}
            </h1>
            <p className="mt-2 text-[15px] text-ink/80">{t('brief.qNote')}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {LEVELS.map((l) => (
                <li key={l}>
                  <button
                    type="button"
                    aria-pressed={briefing.level === l}
                    onClick={() => endBriefing(l)}
                    className={`flex min-h-16 w-full flex-col justify-center rounded-xl border-2 border-ink px-4 py-3 text-left active:scale-[0.98] ${briefing.level === l ? 'bg-olive text-cream' : 'bg-cream text-ink'}`}
                  >
                    <Display className="text-[22px] tracking-wide">{t(`level.${l}`)}</Display>
                    <span className="mt-1 text-[15px] leading-snug">{t(`level.${l}.d`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {step < QUESTION && (
        <div className="mt-6">
          <Button onClick={next}>{step === 0 ? t('brief.toOrders') : step < ORDERS ? t('brief.next') : t('brief.understood')}</Button>
        </div>
      )}
    </div>
  )
}
