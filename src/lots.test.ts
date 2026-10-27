import { describe, expect, it } from 'vitest'
import content from '../content/lots.json' with { type: 'json' }
import { LOTS, currentLots, lotBySlug, parseLotContent } from './lots'

describe('content/lots.json', () => {
  // a fresh, editable copy of the real content file
  const copy = () => structuredClone(content) as { lots: Record<string, any>[] }

  it('the committed file is valid and has the roaster lots', () => {
    expect(() => parseLotContent(content)).not.toThrow()
    expect(LOTS.map((l) => l.slug)).toContain('peru-naranjo-yacu')
    expect(currentLots().length).toBeGreaterThan(0)
  })

  it('finds a lot by slug, and nothing for null or unknown slugs', () => {
    expect(lotBySlug('brazil-lobo-guara')?.name).toBe('Lobo-Guará')
    expect(lotBySlug(null)).toBeUndefined()
    expect(lotBySlug('kenya-unknown')).toBeUndefined()
  })

  it('keeps retired lots for older reports but not in the picker', () => {
    const c = copy()
    c.lots[0].status = 'retired'
    const lots = parseLotContent(c)
    expect(lots).toHaveLength(LOTS.length)
    expect(lots.filter((l) => l.status === 'current')).toHaveLength(LOTS.length - 1)
  })

  it.each<[string, (c: ReturnType<typeof copy>) => void, RegExp]>([
    ['no list', (c) => delete (c as Record<string, unknown>).lots, /expected \{ lots/],
    ['bad slug', (c) => (c.lots[0].slug = 'Peru Lot'), /slug must be/],
    ['duplicate slug', (c) => c.lots.push(structuredClone(c.lots[0])), /appears more than once/],
    ['missing name', (c) => (c.lots[0].name = ''), /name is required/],
    ['notes without pt', (c) => delete c.lots[0].notes.pt, /notes needs en and pt/],
    ['inverted altitude', (c) => (c.lots[0].altitude = [1900, 1700]), /altitude must be/],
    ['unknown profile', (c) => (c.lots[0].profile = 'smoky'), /profile must be one of/],
    ['unknown status', (c) => (c.lots[0].status = 'soon'), /status must be current or retired/],
    ['http url', (c) => (c.lots[0].url = 'http://example.com'), /url must be https/],
  ])('rejects %s', (_name, mutate, err) => {
    const c = copy()
    mutate(c)
    expect(() => parseLotContent(c)).toThrow(err)
  })
})
