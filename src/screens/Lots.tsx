import { currentLots, type Lot } from '../lots'
import { useStore } from '../store'
import { Button, Card, ScreenTitle } from '../ui'
import { BANNER, LotHead, LotPhoto, LotTasting } from './LotCard'

// The roaster's coffees with their bag photos, opened from Profile or the Orders lot card.
// "Brew this" picks the lot and opens Orders; the shop link buys a bag.
export default function Lots({ brew }: { brew: () => void }) {
  const { t, setLot } = useStore()

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle title={t('lots.title')} sub={t('lots.sub')} />
      <ul className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {currentLots().map((lot) => (
          <li key={lot.slug}>
            <Card>
              <LotPhoto lot={lot} className={BANNER} />
              <LotHead lot={lot} />
              <LotTasting lot={lot} />
              <div className="mt-4 flex flex-col gap-1">
                <Button
                  onClick={() => {
                    setLot(lot.slug)
                    brew()
                  }}
                >
                  {t('lots.brew')}
                </Button>
                <BuyLink lot={lot} />
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink/70">{t('lots.credit')}</p>
    </div>
  )
}

// The product page on the roaster's shop, in a new tab
function BuyLink({ lot }: { lot: Lot }) {
  const { t } = useStore()
  return (
    <a
      href={lot.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-cream px-4 text-[15px] font-semibold text-ink active:scale-[0.98]"
    >
      {t('lots.buy')}
      <span aria-hidden="true" className="text-terracotta">↗</span>
      <span className="sr-only">{t('lots.newTab')}</span>
    </a>
  )
}
