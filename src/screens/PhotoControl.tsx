import { useEffect, useRef, useState, type ReactNode } from 'react'
import { photoUrl } from '../api'
import { SIGN_IN_URL } from '../auth'
import type { Report } from '../data'
import type { Key } from '../i18n'
import { PhotoError, compressPhoto } from '../photo'
import { useReports } from '../reports'
import { useStore } from '../store'
import { Card, Label } from '../ui'

// One photo per report, signed-in players only (guests get SignInForPhotos). The photo is resized on the phone
// (src/photo.ts) and uploaded straight away: photos are not queued like reports.

function errorKey(err: unknown): Key {
  if (err instanceof PhotoError) return err.code === 'too_big' ? 'photo.tooBig' : 'photo.unreadable'
  const status = (err as { status?: number }).status
  if (status === 400 || status === 413 || status === 415) return 'photo.refused'
  if (status === 403) return 'photo.limit'
  return 'photo.failed'
}

function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

const buttonClass =
  'flex h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-ink bg-cream px-4 text-[15px] font-semibold text-ink active:scale-[0.98] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terracotta'

// A file input dressed as a button; the input keeps focus, so the label shows the global focus ring (index.css). capture opens the camera straight away; without it the phone offers
// its library (and usually the camera too).
function FileButton({ children, camera, onFile, disabled }: { children: ReactNode; camera?: boolean; onFile: (f: File) => void; disabled?: boolean }) {
  return (
    <label className={`${buttonClass} ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      {children}
      <input
        type="file"
        accept="image/*"
        {...(camera ? { capture: 'environment' as const } : {})}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = '' // so the same file can be picked again
          if (f) onFile(f)
        }}
      />
    </label>
  )
}

function CameraOrGallery({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const { t } = useStore()
  return (
    <div className="grid grid-cols-2 gap-2">
      <FileButton camera onFile={onFile} disabled={disabled}>{t('photo.camera')}</FileButton>
      <FileButton onFile={onFile} disabled={disabled}>{t('photo.gallery')}</FileButton>
    </div>
  )
}

function Status({ busy, error }: { busy: Key | null; error: Key | null }) {
  const { t } = useStore()
  if (busy) return <p className="text-sm text-muted" role="status">{t(busy)}</p>
  if (error) return <p className="rounded-lg border-2 border-terracotta p-2 text-[15px] text-ink" role="alert">{t(error)}</p>
  return null
}

const frame = 'w-full rounded-xl border-2 border-ink bg-line object-cover'

/** Diagnose form: picks and prepares a photo before the report exists. The upload happens once it is filed. */
export function PhotoPicker({ value, onChange }: { value: Blob | null; onChange: (jpeg: Blob | null) => void }) {
  const { t } = useStore()
  const preview = useObjectUrl(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Key | null>(null)
  const pick = async (f: File) => {
    setBusy(true)
    setError(null)
    try {
      onChange(await compressPhoto(f))
    } catch (err) {
      console.warn(err)
      setError(errorKey(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <Label>{t('photo.label')}</Label>
        <p className="mt-1 text-sm text-ink/70">{t('photo.hint')}</p>
      </div>
      {preview && <img src={preview} alt={t('photo.preview')} className={`${frame} aspect-[4/3]`} />}
      <CameraOrGallery onFile={(f) => void pick(f)} disabled={busy} />
      {value && (
        <button type="button" onClick={() => onChange(null)} className="h-11 text-[15px] font-semibold text-ink underline">
          {t('photo.remove')}
        </button>
      )}
      <Status busy={busy ? 'photo.preparing' : null} error={error} />
    </Card>
  )
}

/** For guests, in place of the picker. */
export function SignInForPhotos() {
  const { t } = useStore()
  return (
    <Card className="flex flex-col gap-1">
      <Label>{t('photo.label')}</Label>
      <p className="text-sm text-ink/80">
        {t('photo.guest')}{' '}
        <a href={SIGN_IN_URL} className="font-semibold text-ink underline">{t('auth.signIn')}</a>
      </p>
    </Card>
  )
}

type Busy = 'photo.preparing' | 'photo.uploading' | 'photo.removing'

/**
 * A filed report's photo: add, change or remove. `initial` is a photo picked on the form, uploaded on mount.
 * compact: one row for a Diary entry.
 */
export default function PhotoControl({ report, initial, compact = false }: { report: Report; initial?: Blob | null; compact?: boolean }) {
  const { t, lang } = useStore()
  const { setPhoto } = useReports()
  const [busy, setBusy] = useState<Busy | null>(null)
  const [error, setError] = useState<Key | null>(null)
  // A prepared photo that is uploading or failed to: shown in place of the server's, and kept for Retry
  const [pending, setPending] = useState<Blob | null>(null)
  const preview = useObjectUrl(pending)

  const upload = async (jpeg: Blob) => {
    setPending(jpeg)
    setBusy('photo.uploading')
    setError(null)
    try {
      await setPhoto(report.id, jpeg)
      setPending(null)
    } catch (err) {
      console.warn(err)
      setError(errorKey(err))
    } finally {
      setBusy(null)
    }
  }

  const pick = async (f: File) => {
    setBusy('photo.preparing')
    setError(null)
    let jpeg: Blob
    try {
      jpeg = await compressPhoto(f)
    } catch (err) {
      console.warn(err)
      setError(errorKey(err))
      setBusy(null)
      return
    }
    await upload(jpeg)
  }

  const remove = async () => {
    if (!window.confirm(t('photo.removeConfirm'))) return
    setBusy('photo.removing')
    setError(null)
    setPending(null)
    try {
      await setPhoto(report.id, null)
    } catch (err) {
      console.warn(err)
      setError(errorKey(err))
    } finally {
      setBusy(null)
    }
  }

  // Once, even under StrictMode's double effects
  const started = useRef(false)
  useEffect(() => {
    if (!initial || started.current) return
    started.current = true
    void upload(initial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const src = preview ?? (report.photo ? photoUrl(report.id, report.photo) : null)
  const alt = t('photo.alt', { date: new Date(report.ts).toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB') })
  const retry = error && pending && busy === null && (
    <button type="button" onClick={() => void upload(pending)} className="h-11 text-[15px] font-semibold text-ink underline">
      {t('photo.retry')}
    </button>
  )
  const removeButton = report.photo && !pending && (
    <button type="button" onClick={() => void remove()} disabled={busy !== null} className="h-11 text-[15px] font-semibold text-ink underline disabled:opacity-50">
      {t('photo.remove')}
    </button>
  )

  if (compact) {
    return (
      <div className="flex flex-col gap-1 pt-1">
        <div className="flex items-center gap-3">
          {src && <img src={src} alt={alt} loading="lazy" decoding="async" className={`${frame} !w-16 aspect-square flex-none`} />}
          <FileButton onFile={(f) => void pick(f)} disabled={busy !== null}>
            {t(src ? 'photo.change' : 'photo.add')}
          </FileButton>
          {removeButton}
          {retry}
        </div>
        <Status busy={busy} error={error} />
      </div>
    )
  }

  return (
    <Card className="flex flex-col gap-3">
      <Label>{t('photo.label')}</Label>
      {src && <img src={src} alt={alt} decoding="async" className={`${frame} aspect-[4/3]`} />}
      <CameraOrGallery onFile={(f) => void pick(f)} disabled={busy !== null} />
      <div className="flex flex-wrap gap-x-4">
        {removeButton}
        {retry}
      </div>
      <Status busy={busy} error={error} />
    </Card>
  )
}
