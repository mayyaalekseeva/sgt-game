import { describe, expect, it } from 'vitest'
import { NO_UPDATE, showUpdate, updateStep, type Update } from './sw-update'

const waiting: Update = { phase: 'waiting', asked: false }
const asked: Update = { phase: 'waiting', asked: true }
const active: Update = { phase: 'active', asked: false }

describe('updateStep', () => {
  it('shows the banner when a new worker is waiting', () => {
    expect(updateStep(NO_UPDATE, 'waiting', false)).toEqual({ next: waiting, effect: null })
  })

  it('asks the waiting worker to take over on Reload, then reloads when it does', () => {
    expect(updateStep(waiting, 'reload', false)).toEqual({ next: asked, effect: 'skip-waiting' })
    expect(updateStep(asked, 'controlling', false)).toEqual({ next: active, effect: 'reload-page' })
  })

  it('never reloads a tab that did not ask: another tab activated the worker', () => {
    expect(updateStep(waiting, 'controlling', false)).toEqual({ next: active, effect: null })
    expect(updateStep(NO_UPDATE, 'controlling', false)).toEqual({ next: active, effect: null })
  })

  it('reloads straight away once the worker is already active', () => {
    expect(updateStep(active, 'reload', false)).toEqual({ next: active, effect: 'reload-page' })
  })

  it('never reloads while a brew is being timed', () => {
    expect(updateStep(waiting, 'reload', true)).toEqual({ next: waiting, effect: null })
    expect(updateStep(active, 'reload', true)).toEqual({ next: active, effect: null })
    // the timer started between the tap and the takeover
    expect(updateStep(asked, 'controlling', true)).toEqual({ next: active, effect: null })
  })

  it('does nothing on Reload without an update', () => {
    expect(updateStep(NO_UPDATE, 'reload', false)).toEqual({ next: NO_UPDATE, effect: null })
  })

  it('starts over when a newer worker arrives', () => {
    expect(updateStep(active, 'waiting', false)).toEqual({ next: waiting, effect: null })
  })
})

describe('showUpdate', () => {
  it('shows while an update is waiting or active, hidden during a brew', () => {
    expect(showUpdate(NO_UPDATE, false)).toBe(false)
    expect(showUpdate(waiting, false)).toBe(true)
    expect(showUpdate(active, false)).toBe(true)
    expect(showUpdate(waiting, true)).toBe(false)
  })
})
