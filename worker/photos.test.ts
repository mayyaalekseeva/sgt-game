import { describe, expect, it } from 'vitest'
import { disallowedSegment, etagMatches, isJpeg, isNonce, newNonce, nonceOf, photoEtag, photoKey } from './photos'

// A JPEG header: SOI, the given segments, then SOS and a little scan data
const seg = (marker: number, payload: number[] = [0, 0]) => [0xff, marker, 0, payload.length + 2, ...payload]
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
const jpeg = (...segments: number[][]) =>
  new Uint8Array([0xff, 0xd8, ...segments.flat(), ...seg(0xda, [1, 2, 3]), 0x12, 0x34, 0xff, 0xd9])

const APP0 = seg(0xe0, [...ascii('JFIF'), 0, 1, 1])
const APP2 = seg(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1])
const DQT = seg(0xdb, [0, 1, 2, 3])
const SOF0 = seg(0xc0, [8, 0, 16, 0, 16, 1])

describe('disallowedSegment', () => {
  it('accepts a canvas-style JPEG with JFIF and an ICC profile', () => {
    expect(disallowedSegment(jpeg(APP0, APP2, DQT, SOF0))).toBeNull()
    expect(disallowedSegment(jpeg(DQT, SOF0))).toBeNull()
  })

  it('rejects Exif and XMP (APP1)', () => {
    expect(disallowedSegment(jpeg(APP0, seg(0xe1, [...ascii('Exif'), 0, 0]), SOF0))).toBe('APP1 segment not allowed')
    expect(disallowedSegment(jpeg(seg(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0'))))).toBe('APP1 segment not allowed')
  })

  it('rejects IPTC (APP13) and every other APPn', () => {
    expect(disallowedSegment(jpeg(APP0, seg(0xed, ascii('Photoshop 3.0\0'))))).toBe('APP13 segment not allowed')
    for (const m of [0xe3, 0xe4, 0xec, 0xee, 0xef]) {
      expect(disallowedSegment(jpeg(APP0, seg(m)))).toBe(`APP${m - 0xe0} segment not allowed`)
    }
  })

  it('looks past fill bytes', () => {
    expect(disallowedSegment(jpeg([0xff, ...seg(0xe1)]))).toBe('APP1 segment not allowed')
  })

  it('rejects truncated or malformed headers and non-JPEGs', () => {
    expect(disallowedSegment(jpeg(APP0, SOF0).slice(0, 12))).toBe('truncated header')
    expect(disallowedSegment(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('truncated header')
    expect(disallowedSegment(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0x00, 0xda]))).toBe('malformed header')
    expect(disallowedSegment(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1]))).toBe('malformed header')
    expect(disallowedSegment(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe('no image data')
    expect(disallowedSegment(new Uint8Array(ascii('\x89PNG\r\n')))).toBe('not a JPEG')
  })
})

describe('isJpeg', () => {
  it('checks the SOI marker', () => {
    expect(isJpeg(jpeg())).toBe(true)
    expect(isJpeg(new Uint8Array([0xff, 0xd8]))).toBe(false)
    expect(isJpeg(new Uint8Array(ascii('GIF89a')))).toBe(false)
  })
})

describe('keys and nonces', () => {
  it('makes 16-hex nonces that round-trip through the key', () => {
    const nonce = newNonce()
    expect(isNonce(nonce)).toBe(true)
    expect(newNonce()).not.toBe(nonce)
    const key = photoKey('user-1', 'abc123', nonce)
    expect(key).toBe(`photos/user-1/abc123/${nonce}.jpg`)
    expect(nonceOf(key)).toBe(nonce)
  })

  it('finds no nonce without a valid key', () => {
    expect(nonceOf(null)).toBeNull()
    expect(nonceOf('photos/u/r/xyz.jpg')).toBeNull()
    expect(isNonce('0123456789ABCDEF')).toBe(false)
  })
})

describe('etagMatches', () => {
  const etag = photoEtag('0123456789abcdef')
  it('matches strong, weak, listed and wildcard tags', () => {
    expect(etagMatches(etag, etag)).toBe(true)
    expect(etagMatches(`W/${etag}`, etag)).toBe(true)
    expect(etagMatches(`"other", ${etag}`, etag)).toBe(true)
    expect(etagMatches('*', etag)).toBe(true)
  })
  it('does not match other or missing tags', () => {
    expect(etagMatches('"fedcba9876543210"', etag)).toBe(false)
    expect(etagMatches(null, etag)).toBe(false)
  })
})
