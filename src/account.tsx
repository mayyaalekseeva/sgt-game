import { SIGN_IN_URL, displayName, useAuth, type User } from './auth'
import { useStore } from './store'
import { Card, Label } from './ui'

export const personIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

export function LangToggle() {
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

function SignInLink() {
  const { t } = useStore()
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

// Profile: who is signed in, or what being a guest means
export function AccountCard() {
  const { t } = useStore()
  const { user } = useAuth()
  // Same height while /api/me loads, so the page does not jump
  if (user === undefined) return <Card className="h-24">{null}</Card>
  if (user) {
    return (
      <Card>
        <SignedIn user={user} />
      </Card>
    )
  }
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-[15px] leading-snug">{t('profile.guest')}</p>
      <SignInLink />
    </Card>
  )
}
