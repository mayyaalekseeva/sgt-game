import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

// Swipe a row left on a touch screen to show one action (delete, finish), then tap it. A shortcut only: the same
// action stays on a button in the row's own screen, for a mouse, a keyboard and a screen reader.

// the action's least width; a longer label makes it wider
const WIDTH = 96
// how far a finger moves before it counts as a swipe or a scroll
const SLOP = 8

// the open row: opening another one closes it
let closeOpen: (() => void) | null = null

export interface SwipeAction {
  label: string
  tone: 'danger' | 'neutral'
  onAction: () => void
}

export default function SwipeRow({ action, disabled, className = '', children }: { action: SwipeAction; disabled?: boolean; className?: string; children: ReactNode }) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const drag = useRef({ x: 0, y: 0, base: 0, at: 0, width: WIDTH, mode: 'idle' as 'idle' | 'pending' | 'swipe' | 'scroll', swiped: false })

  const close = useCallback(() => {
    setOffset(0)
    if (closeOpen === close) closeOpen = null
  }, [])

  useEffect(() => () => void (closeOpen === close && (closeOpen = null)), [close])

  // a tap anywhere else closes the open row
  useEffect(() => {
    if (!offset || dragging) return
    const away = (e: globalThis.PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [offset, dragging, close])

  useEffect(() => {
    if (disabled) close()
  }, [disabled, close])

  const down = (e: PointerEvent) => {
    if (disabled || e.pointerType === 'mouse') return
    // as wide as its label in this language, measured before the pull stretches it
    const width = Math.max(WIDTH, button.current?.scrollWidth ?? 0, -offset)
    drag.current = { x: e.clientX, y: e.clientY, base: offset, at: offset, width, mode: 'pending', swiped: false }
  }

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const dx = e.clientX - d.x
    if (d.mode === 'pending') {
      const dy = e.clientY - d.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return
      if (Math.abs(dx) > Math.abs(dy) && (dx < 0 || d.base < 0)) {
        d.mode = 'swipe'
        e.currentTarget.setPointerCapture(e.pointerId)
        if (closeOpen && closeOpen !== close) closeOpen()
        setDragging(true)
      } else {
        d.mode = 'scroll'
      }
    }
    if (d.mode !== 'swipe') return
    const w = d.width
    let x = Math.min(0, d.base + dx)
    // past the action it follows the finger at a third of the speed
    if (x < -w) x = -w + (x + w) / 3
    d.at = x
    setOffset(x)
  }

  const up = () => {
    const d = drag.current
    if (d.mode === 'swipe') {
      d.swiped = true
      const w = d.width
      const open = d.at < -w / 2
      setOffset(open ? -w : 0)
      if (open) closeOpen = close
      else if (closeOpen === close) closeOpen = null
      setDragging(false)
    }
    d.mode = 'idle'
  }

  // the tap that ends a swipe, or lands on an open row, does not open the row
  const click = (e: MouseEvent) => {
    if (!drag.current.swiped && !offset) return
    drag.current.swiped = false
    e.preventDefault()
    e.stopPropagation()
    close()
  }

  const tone = action.tone === 'danger' ? 'bg-terracotta' : 'bg-olive'
  return (
    // every row it wraps sits on cream, so the row covers the action until it slides
    <div ref={box} className={`relative overflow-hidden ${className}`}>
      <button
        ref={button}
        type="button"
        tabIndex={-1}
        aria-hidden={!offset || dragging}
        onClick={() => {
          close()
          action.onAction()
        }}
        className={`absolute inset-y-0 right-0 flex items-center justify-center whitespace-nowrap px-4 font-display text-xl font-extrabold uppercase leading-none tracking-[0.08em] text-cream ${tone}`}
        // grows with the row when pulled past it
        style={{ minWidth: Math.max(WIDTH, -offset) }}
      >
        {action.label}
      </button>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={click}
        className={`relative bg-cream ${dragging ? '' : 'motion-safe:transition-transform motion-safe:duration-200'}`}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </div>
  )
}
