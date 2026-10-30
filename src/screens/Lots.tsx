import { currentLots } from '../lots'
import { useStore } from '../store'
import { Button, Card, ScreenTitle } from '../ui'
import { BuyLink, LotHead, LotPhoto, LotTasting } from './LotCard'

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
              <LotPhoto lot={lot} className="mb-3 aspect-[4/3] w-full" />
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
