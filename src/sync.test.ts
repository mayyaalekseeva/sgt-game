import { describe, expect, it, vi } from 'vitest'
import type { MyCoffee } from './coffees'
import type { Report } from './data'
import { BATCH, applySent, chunks, emptyCache, flush, importGuest, newReportId, parseAccountCache, view, withPhoto, withServer, type Sender } from './sync'

const rep = (id: string, ts = 1_000, over: Partial<Report> = {}): Report => ({
  id,
  ts,
  method: 'espresso',
  roast: 'medium',
  dose: 18,
  yield: 36,
  time: 28,
  taste: 'balanced',
  diag: 'balanced',
  ...over,
})

// ids must be 32 hex characters: pad the tag and map anything else to 'a'
const coffee = (tag: string, updatedAt = 1): MyCoffee => ({
  id: tag.padEnd(32, '0').replace(/[^0-9a-f]/g, 'a'),
  roaster: 'R',
  origin: tag,
  process: 'washed',
  roast: 'light',
  updatedAt,
})

const status = (n: number) => Object.assign(new Error(String(n)), { status: n })

// Records calls; `fail` decides per call whether (and how) it throws
function fakeSender(fail: (kind: 'post' | 'put' | 'coffees', arg: unknown) => Error | null = () => null) {
  const calls: [string, unknown, boolean?][] = []
  const send: Sender = {
    postReports: async (reports, imported) => {
      calls.push(['post', reports.map((r) => r.id), imported])
      const e = fail('post', reports)
      if (e) throw e
    },
    putWorking: async (id) => {
      calls.push(['put', id])
      const e = fail('put', id)
      if (e) throw e
    },
    postCoffees: async (coffees) => {
      calls.push(['coffees', coffees.map((c) => c.id)])
      const e = fail('coffees', coffees)
      if (e) throw e
    },
  }
  return { send, calls }
}

describe('chunks', () => {
  it('splits into batches and keeps the order', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunks([], 2)).toEqual([])
  })
})

describe('view', () => {
  it('shows server reports plus unsent ones, newest first, without duplicates', () => {
    const c = { ...emptyCache(), reports: [rep('a', 1), rep('b', 3)], outbox: { reports: [rep('c', 2), rep('b', 3)], working: {} } }
    expect(view(c).reports.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('lets a queued working recipe win over the server one', () => {
    const c = { ...emptyCache(), working: { 'espresso-medium': 'a', 'filter-light': 'x' }, outbox: { reports: [], working: { 'espresso-medium': 'c' } } }
    expect(view(c).working).toEqual({ 'espresso-medium': 'c', 'filter-light': 'x' })
  })
})

describe('withServer', () => {
  it('replaces the copy and keeps the outbox and the import decision', () => {
    const c = { ...emptyCache(), reports: [rep('old')], importDecided: true, outbox: { reports: [rep('q')], working: {} } }
    const next = withServer(c, { reports: [rep('s')], working: { 'espresso-medium': 's' } })
    expect(next).toEqual({ ...c, reports: [rep('s')], working: { 'espresso-medium': 's' } })
  })
})

describe('withPhoto', () => {
  const P = '0123456789abcdef'
  const c = { ...emptyCache(), reports: [rep('a'), rep('b', 2, { photo: P })], outbox: { reports: [rep('q')], working: {} } }

  it('sets the photo on a report in the copy or in the outbox', () => {
    expect(withPhoto(c, 'a', P).reports[0]).toEqual(rep('a', 1_000, { photo: P }))
    expect(withPhoto(c, 'q', P).outbox.reports[0]).toEqual(rep('q', 1_000, { photo: P }))
  })

  it('removes it, leaving no photo key behind', () => {
    const b = withPhoto(c, 'b', null).reports[1]
    expect(b).not.toHaveProperty('photo')
  })

  it('leaves other reports and an unknown id alone', () => {
    expect(withPhoto(c, 'a', P).reports[1]).toBe(c.reports[1])
    expect(withPhoto(c, 'zzz', P)).toEqual(c)
  })

  it('survives the localStorage round trip', () => {
    const saved = withPhoto(c, 'a', P)
    expect(parseAccountCache(JSON.parse(JSON.stringify(saved))).reports[0].photo).toBe(P)
  })
})

describe('parseAccountCache', () => {
  it('round-trips a cache', () => {
    const c = {
      reports: [rep('a')],
      working: { 'espresso-medium': 'a' },
      coffees: [coffee('c1')],
      outbox: { reports: [rep('b')], working: {}, coffees: [coffee('c2')] },
      importDecided: true,
    }
    expect(parseAccountCache(JSON.parse(JSON.stringify(c)))).toEqual(c)
  })

  it('starts over on anything unreadable', () => {
    expect(parseAccountCache(null)).toEqual(emptyCache())
    expect(parseAccountCache({ reports: [{ id: 1 }], working: {}, outbox: { reports: [], working: {} } })).toEqual(emptyCache())
  })
})

describe('flush', () => {
  const outbox = { reports: [rep('a'), rep('b')], working: { 'espresso-medium': 'a' } }

  it('sends reports before working recipes and reports everything as sent', async () => {
    const { send, calls } = fakeSender()
    expect(await flush(outbox, send)).toEqual(outbox)
    expect(calls).toEqual([['post', ['a', 'b'], false], ['put', 'a']])
  })

  it('sends reports in batches the server accepts', async () => {
    const { send, calls } = fakeSender()
    const many = Array.from({ length: BATCH + 1 }, (_, i) => rep(`r${i}`))
    await flush({ reports: many, working: {} }, send)
    expect(calls.map((c) => (c[1] as string[]).length)).toEqual([BATCH, 1])
  })

  it.each([0, 401, 500, 503])('stops when a send may pass later (status %s) and does not send working recipes', async (code) => {
    const { send, calls } = fakeSender((kind) => (kind === 'post' ? status(code) : null))
    expect(await flush(outbox, send)).toEqual({ reports: [], working: {} })
    expect(calls).toHaveLength(1)
  })

  it('keeps what got through before a failure', async () => {
    const { send } = fakeSender((kind) => (kind === 'put' ? status(503) : null))
    expect(await flush(outbox, send)).toEqual({ reports: outbox.reports, working: {} })
  })

  it('drops what the server refuses, so it cannot block the outbox', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { send } = fakeSender((kind) => (kind === 'post' ? status(400) : status(404)))
    expect(await flush(outbox, send)).toEqual(outbox)
  })
})

describe('applySent', () => {
  it('moves sent items into the copy and keeps writes made meanwhile', () => {
    const c = {
      ...emptyCache(),
      reports: [rep('s')],
      outbox: { reports: [rep('a'), rep('new')], working: { 'espresso-medium': 'new', 'filter-light': 'f' } },
    }
    const next = applySent(c, { reports: [rep('a')], working: { 'espresso-medium': 'a', 'filter-light': 'f' } })
    expect(next.reports.map((r) => r.id)).toEqual(['s', 'a'])
    expect(next.outbox).toEqual({ reports: [rep('new')], working: { 'espresso-medium': 'new' } })
    expect(view(next).working['espresso-medium']).toBe('new')
  })

  it('does not duplicate a report the copy already has', () => {
    const c = { ...emptyCache(), reports: [rep('a')], outbox: { reports: [rep('a')], working: {} } }
    expect(applySent(c, { reports: [rep('a')], working: {} }).reports).toHaveLength(1)
  })
})

describe('importGuest', () => {
  const guest = { reports: [rep('g1'), rep('g2', 1_000, { method: 'filter', roast: 'light' })], working: { 'espresso-medium': 'g1', 'filter-light': 'g2', 'filter-dark': 'gone' } }

  it('sends reports as imported, and only working recipes the account lacks', async () => {
    const { send, calls } = fakeSender()
    const sent = await importGuest(guest, { 'espresso-medium': 'server' }, send)
    expect(calls).toEqual([['post', ['g1', 'g2'], true], ['put', 'g2']])
    expect(sent).toEqual({ reports: guest.reports, working: { 'filter-light': 'g2' } })
  })

  it('throws when reports do not go through, so the offer stays', async () => {
    const { send } = fakeSender((kind) => (kind === 'post' ? status(503) : null))
    await expect(importGuest(guest, {}, send)).rejects.toThrow()
  })

  it('skips a working recipe the server refuses', async () => {
    const { send } = fakeSender((kind) => (kind === 'put' ? status(404) : null))
    expect((await importGuest(guest, {}, send)).working).toEqual({})
  })
})

describe('coffees', () => {
  it('sends coffees before reports, and records them as sent', async () => {
    const { send, calls } = fakeSender()
    const outbox = { reports: [rep('a')], working: {}, coffees: [coffee('c1')] }
    expect(await flush(outbox, send)).toEqual(outbox)
    expect(calls.map((c) => c[0])).toEqual(['coffees', 'post'])
  })

  it('stops before reports when coffees may pass later', async () => {
    const { send, calls } = fakeSender((kind) => (kind === 'coffees' ? status(503) : null))
    expect(await flush({ reports: [rep('a')], working: {}, coffees: [coffee('c1')] }, send)).toEqual({ reports: [], working: {} })
    expect(calls).toHaveLength(1)
  })

  it('shows queued edits over the copy, and keeps an edit made while sending', () => {
    const sent = coffee('c1', 1)
    const newer = { ...coffee('c1', 2), origin: 'Kenya' }
    const c = { ...emptyCache(), outbox: { reports: [], working: {}, coffees: [newer] } }
    const next = applySent(c, { reports: [], working: {}, coffees: [sent] })
    expect(next.outbox.coffees).toEqual([newer])
    expect(view(next).coffees).toEqual([newer])
    const done = applySent(next, { reports: [], working: {}, coffees: [newer] })
    expect(done.outbox).toEqual({ reports: [], working: {} })
    expect(view(done).coffees).toEqual([newer])
  })

  it('keeps cached coffees when the server sends none, and takes the server list when it does', () => {
    const c = { ...emptyCache(), coffees: [coffee('c1')] }
    expect(withServer(c, { reports: [], working: {} }).coffees).toEqual([coffee('c1')])
    expect(withServer(c, { reports: [], working: {}, coffees: [] }).coffees).toEqual([])
  })

  it('imports guest coffees before their reports', async () => {
    const { send, calls } = fakeSender()
    const sent = await importGuest({ reports: [rep('g')], working: {}, coffees: [coffee('c1')] }, {}, send)
    expect(calls.map((c) => c[0])).toEqual(['coffees', 'post'])
    expect(sent.coffees).toEqual([coffee('c1')])
  })
})

describe('newReportId', () => {
  it('makes ids the API accepts, different each time', () => {
    const a = newReportId()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(newReportId()).not.toBe(a)
  })
})
