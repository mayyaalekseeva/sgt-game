import { describe, expect, it } from 'vitest'
import { QUALITIES, TARGET_BYTES, encodeWithin, fitWithin } from './photo'

describe('fitWithin', () => {
  it('scales the longest edge down to 1600', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(8000, 1000)).toEqual({ width: 1600, height: 200 })
  })

  it('never enlarges a small photo', () => {
    expect(fitWithin(1200, 900)).toEqual({ width: 1200, height: 900 })
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 })
  })

  it('keeps at least one pixel', () => {
    expect(fitWithin(100000, 10)).toEqual({ width: 1600, height: 1 })
  })
})

describe('encodeWithin', () => {
  const sized = (bytes: Record<number, number>) => {
    const tried: number[] = []
    const encode = async (q: number) => {
      tried.push(q)
      return new Blob([new Uint8Array(bytes[q])])
    }
    return { tried, encode }
  }

  it('stops at the first quality under the target', async () => {
    const { tried, encode } = sized({ 0.82: 400_000, 0.7: 1, 0.6: 1 })
    expect((await encodeWithin(encode)).size).toBe(400_000)
    expect(tried).toEqual([0.82])
  })

  it('steps the quality down while the result is too big', async () => {
    const { tried, encode } = sized({ 0.82: TARGET_BYTES + 1, 0.7: TARGET_BYTES, 0.6: 1 })
    expect((await encodeWithin(encode)).size).toBe(TARGET_BYTES)
    expect(tried).toEqual([0.82, 0.7])
  })

  it('keeps the last try when none fits', async () => {
    const { tried, encode } = sized({ 0.82: 3e6, 0.7: 2e6, 0.6: 1.5e6 })
    expect((await encodeWithin(encode)).size).toBe(1.5e6)
    expect(tried).toEqual(QUALITIES)
  })
})
