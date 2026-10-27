import { useEffect, useState, type ReactNode } from 'react'
import { ImportOffer, LangToggle, personIcon } from './account'
import { initial, useAuth } from './auth'
import { parseRoute, routeHash, type Route, type Sub, type Tab } from './route'
import { useStore } from './store'
import Orders from './screens/Orders'
import Diagnose from './screens/Diagnose'
import Recipes from './screens/Recipes'
import Profile from './screens/Profile'
import Missions from './screens/Missions'
import Dossier from './screens/Dossier'
import Diary from './screens/Diary'
import SavedRecipes from './screens/SavedRecipes'
import { BackButton, Display } from './ui'

// The current screen, kept in the URL hash. go() adds a history entry; the hashchange listener
// follows it, and also follows the browser's back and forward buttons.
function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  useEffect(() => {
    const follow = () => {
      setRoute(parseRoute(location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])
  const go = (r: Route) => {
    if (routeHash(r) !== location.hash) location.hash = routeHash(r)
  }
  return [route, go] as const
}

const icon = (d: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

const NAV: { id: Tab; icon: ReactNode }[] = [
  { id: 'orders', icon: icon(<><path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6" /></>) },
  { id: 'diag', icon: icon(<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>) },
  { id: 'recipes', icon: icon(<><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M9 3v3M12 3v3" /></>) },
  { id: 'profile', icon: personIcon },
]

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <img src="./brand/logo.png" alt="A Sargento" className="h-9 w-9 rounded-full bg-cream object-contain p-0.5 lg:h-11 lg:w-11" />
      <Display className="text-xl tracking-[0.1em]">Barista Game</Display>
    </div>
  )
}

// Mobile header: the user's initial (or a person icon for guests), opening Profile
function ProfileButton({ onClick }: { onClick: () => void }) {
  const { t } = useStore()
  const { user } = useAuth()
  const box = 'flex h-10 w-10 items-center justify-center rounded-lg border-2 border-ink'
  // Same footprint while /api/me loads, so the header does not shift
  if (user === undefined) return <div className="h-10 w-10" aria-hidden="true" />
  return (
    <button
      type="button"
      aria-label={t('tab.profile')}
      onClick={onClick}
      className={user ? `${box} bg-olive font-display text-lg font-extrabold text-cream` : `${box} text-ink`}
    >
      {user ? initial(user) : personIcon}
    </button>
  )
}

function SignInFailed() {
  const { t } = useStore()
  const { failed, dismissFailed } = useAuth()
  if (!failed) return null
  return (
    <div role="alert" className="mb-4 flex items-center gap-3 rounded-xl border-2 border-terracotta bg-cream p-3">
      <p className="flex-1 text-[15px] text-ink">{t('auth.failed')}</p>
      <button
        type="button"
        aria-label={t('auth.dismiss')}
        onClick={dismissFailed}
        className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-2xl leading-none text-ink"
      >
        ×
      </button>
    </div>
  )
}

// Mobile: header + fixed bottom tabs, one 480px column.
// Desktop (lg): sticky sidebar with brand, nav and language; screens lay out in two columns.
export default function App() {
  const { t } = useStore()
  const [{ tab, sub }, go] = useRoute()
  const select = (id: Tab) => go({ tab: id, sub: null })
  // A sub-screen opens over the current tab, which stays highlighted; back returns to it
  const open = (s: Sub) => go({ tab, sub: s })

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col lg:max-w-[1200px] lg:flex-row lg:gap-12 lg:px-8">
      <header className="flex items-center justify-between px-4 pb-2 pt-4 lg:hidden">
        <Brand />
        <ProfileButton onClick={() => select('profile')} />
      </header>

      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:flex-none lg:flex-col lg:gap-8 lg:py-8">
        <Brand />
        <nav aria-label="Main">
          <ul className="flex flex-col gap-2">
            {NAV.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  aria-current={tab === x.id ? 'page' : undefined}
                  onClick={() => select(x.id)}
                  className={`flex h-12 w-full items-center gap-3 rounded-xl border-2 px-3 text-[15px] font-semibold ${tab === x.id ? 'border-ink bg-olive text-cream' : 'border-transparent text-ink hover:border-ink hover:bg-cream'}`}
                >
                  {x.icon}
                  {t(`tab.${x.id}`)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <LangToggle />
          <p className="text-xs text-ink/70">{t('footer')}</p>
        </div>
      </aside>

      <main className="flex-1 px-4 pb-28 pt-2 lg:min-w-0 lg:px-0 lg:py-8">
        <SignInFailed />
        <ImportOffer />
        {sub ? (
          <>
            <BackButton label={t(`tab.${tab}`)} onClick={() => select(tab)} />
            {sub === 'saved' && <SavedRecipes />}
            {sub === 'diary' && <Diary />}
            {sub === 'missions' && <Missions />}
            {sub === 'dossier' && <Dossier />}
          </>
        ) : (
          <>
            {tab === 'orders' && <Orders go={() => select('diag')} openRecipes={() => select('recipes')} />}
            {tab === 'diag' && <Diagnose openDiary={() => open('diary')} />}
            {tab === 'recipes' && <Recipes use={() => select('orders')} />}
            {tab === 'profile' && <Profile open={open} />}
          </>
        )}
        <p className="mt-8 text-center text-xs text-ink/70 lg:hidden">{t('footer')}</p>
      </main>

      <nav
        aria-label="Main"
        className="safe-bottom fixed bottom-0 left-1/2 z-10 w-full max-w-[480px] -translate-x-1/2 border-t-2 border-ink bg-cream lg:hidden"
      >
        <ul className="flex">
          {NAV.map((x) => (
            <li key={x.id} className="flex-1">
              <button
                type="button"
                aria-current={tab === x.id ? 'page' : undefined}
                onClick={() => select(x.id)}
                className={`flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${tab === x.id ? 'bg-olive text-cream' : 'text-ink'}`}
              >
                {x.icon}
                {t(`tab.${x.id}`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
