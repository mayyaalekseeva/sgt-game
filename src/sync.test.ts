import { describe, expect, it, vi } from 'vitest'
import type { MyCoffee } from './coffees'
import type { Report } from './data'
import {
  BATCH,
  applySent,
  chunks,
  emptyCache,
  flush,
  importGuest,
  mergePassed,
  newReportId,
  parseAccountCache,
  queueDelete,
  queueEdit,
  view,
  withPhoto,
  withServer,
  type Sender,
} from './sync'

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
function fakeSender(fail: (kind: 'post' | 'put' | 'coffees' | 'patch' | 'delete' | 'drills', arg: unknown) => Error | null = () => null) {
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
    patchReport: async (id, edit) => {
      calls.push(['patch', [id, edit.editedAt]])
      const e = fail('patch', id)
      if (e) throw e
    },
    deleteReport: async (id) => {
      calls.push(['delete', id])
      const e = fail('delete', id)
      if (e) throw e
    },
    postDrills: async (drills) => {
      calls.push(['drills', drills.map((d) => d.id)])
      const e = fail('drills', drills)
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
      drills: { ratio: 4 },
      outbox: { reports: [rep('b')], working: {}, coffees: [coffee('c2')], drills: { channeling: 5 } },
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

describe('editing and deleting', () => {
  const T = 5_000
  // a: on the server; q: filed offline, still queued
  const base = () => ({
    ...emptyCache(),
    reports: [rep('a', 1, { grinder: '12', notes: 'old' })],
    working: { 'espresso-medium': 'a' },
    outbox: { reports: [rep('q', 2)], working: { 'filter-v60': 'q' } },
  })

  describe('queueEdit', () => {
    it('queues an edit for a report the server has, and shows it at once, marked as edited', () => {
      const c = queueEdit(base(), 'a', { grinder: ' 14 ', notes: '' }, T)
      expect(c.outbox.edits).toEqual({ a: { grinder: '14', editedAt: T } })
      const a = view(c).reports.find((r) => r.id === 'a')!
      expect(a).toMatchObject({ grinder: '14', editedAt: T, dose: 18 })
      expect(a).not.toHaveProperty('notes')
    })

    it('changes a queued report in place, without an edited mark', () => {
      const c = queueEdit(base(), 'q', { grinder: '9', notes: 'fresh' }, T)
      expect(c.outbox.edits).toBeUndefined()
      expect(c.outbox.reports[0]).toEqual(rep('q', 2, { grinder: '9', notes: 'fresh' }))
    })

    it('sets or clears the grinder with the rest, ignoring a malformed id', () => {
      const set = queueEdit(base(), 'a', { grinder: '14', grinderModel: 'niche-zero' }, T)
      expect(set.outbox.edits).toEqual({ a: { grinder: '14', grinderModel: 'niche-zero', editedAt: T } })
      expect(view(set).reports.find((r) => r.id === 'a')).toMatchObject({ grinder: '14', grinderModel: 'niche-zero' })
      const withModel = { ...base(), reports: [rep('a', 1, { grinderModel: 'niche-zero' })] }
      expect(view(queueEdit(withModel, 'a', { grinderModel: '' }, T)).reports.find((r) => r.id === 'a')).not.toHaveProperty('grinderModel')
      expect(queueEdit(base(), 'a', { grinderModel: 'Niche Zero' }, T).outbox.edits).toEqual({ a: { editedAt: T } })
    })

    it('keeps only the latest edit of a report', () => {
      const c = queueEdit(queueEdit(base(), 'a', { notes: 'one' }, T), 'a', { notes: 'two' }, T + 1)
      expect(c.outbox.edits).toEqual({ a: { notes: 'two', editedAt: T + 1 } })
    })

    it('does not undo a newer edit made on another device', () => {
      const c = queueEdit(base(), 'a', { notes: 'mine' }, T)
      const later = { ...c, reports: [rep('a', 1, { notes: 'theirs', editedAt: T + 10 })] }
      expect(view(later).reports.find((r) => r.id === 'a')!.notes).toBe('theirs')
    })
  })

  describe('queueDelete', () => {
    it('hides the report and its working recipe at once', () => {
      const v = view(queueDelete(base(), 'a'))
      expect(v.reports.map((r) => r.id)).toEqual(['q'])
      expect(v.working).toEqual({ 'filter-v60': 'q' })
    })

    it('drops what was still queued for that report', () => {
      const edited = queueEdit(base(), 'a', { notes: 'x' }, T)
      expect(queueDelete(edited, 'a').outbox.edits).toEqual({})
      const c = queueDelete(base(), 'q')
      expect(c.outbox.reports).toEqual([])
      expect(c.outbox.working).toEqual({})
      expect(c.outbox.deletes).toEqual(['q'])
    })

    it('queues each id once', () => {
      expect(queueDelete(queueDelete(base(), 'a'), 'a').outbox.deletes).toEqual(['a'])
    })
  })

  describe('flush and applySent', () => {
    it('sends reports, edits, working recipes, then deletes', async () => {
      const c = queueDelete(queueEdit(base(), 'a', { notes: 'x' }, T), 'zz')
      const { send, calls } = fakeSender()
      await flush(c.outbox, send)
      expect(calls.map((x) => x[0])).toEqual(['post', 'patch', 'put', 'delete'])
    })

    it('stops before the deletes when a working recipe fails for now', async () => {
      const c = queueDelete(base(), 'a')
      const { send } = fakeSender((kind) => (kind === 'put' ? status(503) : null))
      expect((await flush(c.outbox, send)).deletes).toBeUndefined()
    })

    it('drops an edit the server refuses (the report was deleted elsewhere)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const c = queueEdit(base(), 'a', { notes: 'x' }, T)
      const { send } = fakeSender((kind) => (kind === 'patch' ? status(404) : null))
      const sent = await flush(c.outbox, send)
      expect(applySent(c, sent).outbox.edits).toBeUndefined()
    })

    it('moves sent edits and deletes into the copy', async () => {
      const c = queueDelete(queueEdit(base(), 'a', { notes: 'x' }, T), 'q')
      const { send } = fakeSender()
      const after = applySent(c, await flush(c.outbox, send))
      expect(after.outbox).toEqual({ reports: [], working: {} })
      // the edit cleared the grinder: only notes were sent
      const { grinder: _grinder, ...a } = rep('a', 1, { notes: 'x', editedAt: T })
      expect(after.reports).toEqual([a])
    })

    it('keeps an edit made while the older one was being sent', async () => {
      const c = queueEdit(base(), 'a', { notes: 'one' }, T)
      const { send } = fakeSender()
      const sent = await flush(c.outbox, send)
      const meanwhile = queueEdit(c, 'a', { notes: 'two' }, T + 1)
      expect(applySent(meanwhile, sent).outbox.edits).toEqual({ a: { notes: 'two', editedAt: T + 1 } })
    })

    it('forgets a deleted report as working recipe once sent', async () => {
      const c = queueDelete(base(), 'a')
      const { send } = fakeSender()
      const after = applySent(c, await flush(c.outbox, send))
      expect(after.working).toEqual({ 'filter-v60': 'q' })
      expect(after.reports.map((r) => r.id)).toEqual(['q'])
    })
  })

  it('keeps queued edits and deletes through localStorage, dropping malformed ones', () => {
    const c = queueDelete(queueEdit(base(), 'a', { grinder: '14' }, T), 'b')
    const raw = JSON.parse(JSON.stringify(c))
    raw.outbox.edits.bad = { notes: 5 }
    raw.outbox.deletes.push(7)
    const back = parseAccountCache(raw)
    expect(back.outbox.edits).toEqual({ a: { grinder: '14', editedAt: T } })
    expect(back.outbox.deletes).toEqual(['b'])
  })
})

describe('drills', () => {
  it('keeps the first pass of each drill', () => {
    expect(mergePassed({ ratio: 5, extraction: 1 }, { ratio: 3, extraction: 2, channeling: 9 })).toEqual({ ratio: 3, extraction: 1, channeling: 9 })
  })

  it('shows a queued pass at once, next to the server ones', () => {
    const c = { ...emptyCache(), drills: { 'one-change': 1 }, outbox: { reports: [], working: {}, drills: { extraction: 2 } } }
    expect(view(c).drills).toEqual({ 'one-change': 1, extraction: 2 })
  })

  it('sends passed drills and moves them into the copy', async () => {
    const { send, calls } = fakeSender()
    const c = { ...emptyCache(), outbox: { reports: [rep('a')], working: {}, drills: { extraction: 2 } } }
    const sent = await flush(c.outbox, send)
    expect(calls).toContainEqual(['drills', ['extraction']])
    const after = applySent(c, sent)
    expect(after.drills).toEqual({ extraction: 2 })
    expect(after.outbox.drills).toBeUndefined()
  })

  it('keeps passes queued while offline', async () => {
    const { send } = fakeSender((kind) => (kind === 'drills' ? new TypeError('offline') : null))
    const sent = await flush({ reports: [], working: {}, drills: { ratio: 4 } }, send)
    expect(sent.drills).toBeUndefined()
  })

  it('takes the server passes, and keeps the cached ones when it sends none', () => {
    const c = { ...emptyCache(), drills: { ratio: 4 } }
    expect(withServer(c, { reports: [], working: {} }).drills).toEqual({ ratio: 4 })
    expect(withServer(c, { reports: [], working: {}, drills: { extraction: 1 } }).drills).toEqual({ extraction: 1 })
  })

  it('imports guest passes and survives the localStorage round trip', async () => {
    const { send, calls } = fakeSender()
    const sent = await importGuest({ reports: [], working: {}, drills: { 'one-change': 7 } }, {}, send)
    expect(calls).toEqual([['drills', ['one-change']]])
    expect(sent.drills).toEqual({ 'one-change': 7 })
    const c = { ...emptyCache(), drills: { ratio: 4 }, outbox: { reports: [], working: {}, drills: { channeling: 5, nope: 1 } as never } }
    const back = parseAccountCache(JSON.parse(JSON.stringify(c)))
    expect(back.drills).toEqual({ ratio: 4 })
    expect(back.outbox.drills).toEqual({ channeling: 5 })
  })
})
