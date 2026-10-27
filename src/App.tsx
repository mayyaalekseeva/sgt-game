import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SIGN_IN_URL, displayName, initial, useAuth, type User } from './auth'
import { useStore } from './store'
import Orders from './screens/Orders'
import Diagnose from './screens/Diagnose'
import Missions from './screens/Missions'
import Dossier from './screens/Dossier'
import { Card, Display, Label } from './ui'

type Tab = 'orders' | 'diag' | 'missions' | 'dossier'

const icon = (d: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

const TABS: { id: Tab; icon: ReactNode }[] = [
  { id: 'orders', icon: icon(<><path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6" /></>) },
  { id: 'diag', icon: icon(<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>) },
  { id: 'missions', icon: icon(<><path d="M5 20V4" /><path d="M5 5h12l-2 4 2 4H5" /></>) },
  { id: 'dossier', icon: icon(<><path d="M5 5a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2z" /><path d="M5 19V5" /></>) },
]

const personIcon = icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>)

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <img src="./brand/logo.png" alt="A Sargento" className="h-9 w-9 rounded-full bg-cream object-contain p-0.5 lg:h-11 lg:w-11" />
      <Display className="text-xl tracking-[0.1em]">Barista Game</Display>
    </div>
  )
}

function LangToggle() {
  const { lang, setLang } = useStore()
  return (
    <div className="flex overflow-hidden rounded-lg border-2 border-ink">
      {(['en', 'pt'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          aria-label={l === 'en' ? 'English' : 'Português'}
          onClick={() => setLang(l)}
          className={`h-10 min-w-12 flex-1 text-sm font-semibold ${lang === l ? 'bg-ink text-cream' : 'bg-transparent text-ink'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function SignedIn({ user }: { user: User }) {
  const { t } = useStore()
  const { signOut } = useAuth()
  return (
    <>
      <Label>{t('auth.signedInAs')}</Label>
      <p className="mt-1 truncate font-semibold text-ink">{displayName(user)}</p>
      {user.name && <p className="truncate text-sm text-muted">{user.email}</p>}
      <button
        type="button"
        onClick={signOut}
        className="mt-3 h-11 w-full rounded-lg border-2 border-ink bg-cream text-[15px] font-semibold text-ink"
      >
        {t('auth.signOut')}
      </button>
    </>
  )
}

// Mobile header: an icon that signs in, or the user's initial opening a small account card
function AccountButton() {
  const { t } = useStore()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const box = 'flex h-10 w-10 items-center justify-center rounded-lg border-2 border-ink'
  // Same footprint while /api/me loads, so the header does not shift
  if (user === undefined) return <div className="h-10 w-10" aria-hidden="true" />
  if (!user) {
    return (
      <a href={SIGN_IN_URL} aria-label={t('auth.signIn')} title={t('auth.signIn')} className={`${box} text-ink`}>
        {personIcon}
      </a>
    )
  }
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t('auth.account')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${box} bg-olive font-display text-lg font-extrabold text-cream`}
      >
        {initial(user)}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-20 w-64">
          <Card>
            <SignedIn user={user} />
          </Card>
        </div>
      )}
    </div>
  )
}

function AccountPanel() {
  const { t } = useStore()
  const { user } = useAuth()
  if (user === undefined) return null
  if (!user) {
    return (
      <a
        href={SIGN_IN_URL}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-cream px-3 text-[15px] font-semibold text-ink"
      >
        {personIcon}
        {t('auth.signIn')}
      </a>
    )
  }
  return (
    <Card className="!p-3">
      <SignedIn user={user} />
    </Card>
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
  const [tab, setTab] = useState<Tab>('orders')
  const select = (id: Tab) => {
    setTab(id)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col lg:max-w-[1200px] lg:flex-row lg:gap-12 lg:px-8">
      <header className="flex items-center justify-between px-4 pb-2 pt-4 lg:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <LangToggle />
          <AccountButton />
        </div>
      </header>

      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:flex-none lg:flex-col lg:gap-8 lg:py-8">
        <Brand />
        <nav aria-label="Main">
          <ul className="flex flex-col gap-2">
            {TABS.map((x) => (
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
          <AccountPanel />
          <LangToggle />
          <p className="text-xs text-ink/70">{t('footer')}</p>
        </div>
      </aside>

      <main className="flex-1 px-4 pb-28 pt-2 lg:min-w-0 lg:px-0 lg:py-8">
        <SignInFailed />
        {tab === 'orders' && <Orders go={() => setTab('diag')} />}
        {tab === 'diag' && <Diagnose />}
        {tab === 'missions' && <Missions />}
        {tab === 'dossier' && <Dossier />}
        <p className="mt-8 text-center text-xs text-ink/70 lg:hidden">{t('footer')}</p>
      </main>

      <nav
        aria-label="Main"
        className="safe-bottom fixed bottom-0 left-1/2 z-10 w-full max-w-[480px] -translate-x-1/2 border-t-2 border-ink bg-cream lg:hidden"
      >
        <ul className="flex">
          {TABS.map((x) => (
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
