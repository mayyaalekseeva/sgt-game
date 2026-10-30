import { describe, expect, it } from 'vitest'
import { QUALITIES, TARGET_BYTES, encodeWithin, fitWithin, isHeicHeader } from './photo'

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

describe('isHeicHeader', () => {
  // an ftyp box: size, 'ftyp', major brand, minor version, compatible brands
  const ftyp = (major: string, ...compatible: string[]) => {
    const brands = [major, '\0\0\0\0', ...compatible].join('')
    const size = 8 + brands.length
    const head = [0, 0, 0, size, ...'ftyp'].map((c) => (typeof c === 'number' ? c : c.charCodeAt(0)))
    return new Uint8Array([...head, ...[...brands].map((c) => c.charCodeAt(0)), ...new Array(32).fill(0)])
  }

  it('knows an iPhone photo by its major brand', () => {
    expect(isHeicHeader(ftyp('heic', 'mif1', 'heic'))).toBe(true)
    expect(isHeicHeader(ftyp('heix'))).toBe(true)
  })

  it('knows a HEIF by a compatible brand', () => {
    expect(isHeicHeader(ftyp('isom', 'mif1'))).toBe(true)
  })

  it('leaves AVIF, MP4, JPEG and short files to the browser', () => {
    expect(isHeicHeader(ftyp('avif', 'avif', 'mif1', 'miaf'))).toBe(false)
    expect(isHeicHeader(ftyp('isom', 'iso2', 'mp41'))).toBe(false)
    expect(isHeicHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(20).fill(0)]))).toBe(false)
    expect(isHeicHeader(new Uint8Array([0, 0, 0, 24]))).toBe(false)
  })

  it('does not read brands past the end of the ftyp box', () => {
    const b = ftyp('isom', 'iso2')
    b.set([..."heic"].map((c) => c.charCodeAt(0)), 24)
    expect(isHeicHeader(b)).toBe(false)
  })
})
