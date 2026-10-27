import type { Step } from './data'

export interface TimerState {
  current: number // index of the step in progress, -1 before the first one
  next: number | null // index of the step after it, null once the last step has started
  toNext: number // whole seconds until the next step, 0 when there is none
}

/** Where a running brew is: the last step that has started, and how long until the one after it. */
export function timerState(steps: Step[], elapsed: number): TimerState {
  let current = -1
  for (let i = 0; i < steps.length; i++) if (steps[i].at <= elapsed) current = i
  const next = current + 1 < steps.length ? current + 1 : null
  return { current, next, toNext: next === null ? 0 : Math.ceil(steps[next].at - elapsed) }
}

/** Whole seconds since start, for the clock and the report; never negative (a clock change can go back). */
export const elapsedSeconds = (startedAt: number, now: number) => Math.max(0, Math.floor((now - startedAt) / 1000))
