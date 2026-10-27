import { afterEach, describe, expect, it, vi } from 'vitest'
import { logError } from './log'

afterEach(() => vi.restoreAllMocks())

const logged = (stage: string, err: unknown) => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  logError(stage, err)
  return JSON.parse(spy.mock.calls[0][0] as string)
}

describe('logError', () => {
  it('logs stage, message and stack as one JSON line', () => {
    const line = logged('google_callback.token_exchange', new Error('Google token exchange failed: 400'))
    expect(line).toMatchObject({ stage: 'google_callback.token_exchange', name: 'Error', message: 'Google token exchange failed: 400' })
    expect(line.stack).toContain('log.test.ts')
  })

  it('drops Drizzle query params but keeps the SQL and the D1 cause', () => {
    const err = new Error('Failed query: insert into "users" values (?, ?)\nparams: abc,barista@example.com', {
      cause: new Error('D1_ERROR: no such table: users: SQLITE_ERROR'),
    })
    const line = logged('google_callback.user_upsert', err)
    expect(JSON.stringify(line)).not.toContain('barista@example.com')
    expect(line.message).toBe('Failed query: insert into "users" values (?, ?)')
    expect(line.cause.message).toBe('D1_ERROR: no such table: users: SQLITE_ERROR')
  })

  it('handles thrown non-errors', () => {
    expect(logged('unhandled', 'boom')).toEqual({ stage: 'unhandled', error: 'boom' })
  })
})
