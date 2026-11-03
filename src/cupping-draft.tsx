import { useCallback, useEffect, useRef, useState } from 'react'
import { parseSession, pickDraft, touched, type CuppingSession } from './cuppings'
import { useReports } from './reports'

// The open cupping session, autosaved. Every change is written to this browser's draft at once, so a dropped
// connection or a closed tab loses nothing; it goes to useReports (the outbox when signed in) after a short pause,
// and right away when the page is hidden or the screen closes. Taps on a stepper do not each become a request.

const draftKey = (id: string) => `barista-game:cupping-draft:${id}`
const SAVE_AFTER_MS = 800

function readDraft(id: string | undefined): CuppingSession | null {
  if (!id) return null
  try {
    const raw = localStorage.getItem(draftKey(id))
    return raw ? parseSession(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeDraft(s: CuppingSession | null, id: string) {
  try {
    if (s) localStorage.setItem(draftKey(id), JSON.stringify(s))
    else localStorage.removeItem(draftKey(id))
  } catch {
    /* storage unavailable: the save after the pause still goes out */
  }
}

export function useCuppingSession(id: string | undefined) {
  const { cuppings, saveCupping } = useReports()
  const saved = cuppings.find((s) => s.id === id)
  const [draft, setDraft] = useState(() => readDraft(id))
  const session = pickDraft(saved, draft)

  const save = useRef(saveCupping)
  useEffect(() => {
    save.current = saveCupping
  }, [saveCupping])

  const pending = useRef<CuppingSession | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (pending.current) save.current(pending.current)
    pending.current = null
  }, [])

  // the saved copy caught up (this save, or a newer one from another device): the draft is done
  useEffect(() => {
    if (id && draft && saved && saved.updatedAt >= draft.updatedAt && !pending.current) {
      setDraft(null)
      writeDraft(null, id)
    }
  }, [id, draft, saved])

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  const change = useCallback(
    (f: (s: CuppingSession) => CuppingSession) => {
      if (!session) return
      const next = touched(f(session), Date.now())
      setDraft(next)
      writeDraft(next, next.id)
      pending.current = next
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_AFTER_MS)
    },
    [session, flush],
  )

  // deleting the session: nothing pending may be saved after it, or a guest's session would come back
  const discard = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    pending.current = null
    if (id) writeDraft(null, id)
  }, [id])

  return { session, change, flush, discard }
}
