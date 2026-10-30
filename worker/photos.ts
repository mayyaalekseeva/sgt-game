// One photo per report, stored in R2 (binding PHOTOS) and served only to its owner through the Worker.
// The client resizes and re-encodes before upload (src/photo.ts); the server cannot re-encode, so it
// rejects anything that still carries metadata.

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
// Bounds storage per account: every report can hold one photo, and reports are not capped
export const MAX_PHOTOS_PER_USER = 2000

// A new nonce per upload: the URL changes with the photo, so it can be cached forever
const NONCE = /^[0-9a-f]{16}$/
const KEY = /^photos\/[^/]+\/[^/]+\/([0-9a-f]{16})\.jpg$/

export const isNonce = (v: unknown): v is string => typeof v === 'string' && NONCE.test(v)

export function newNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// The user id prefix lets one list({ prefix }) find all of an account's photos
export const photoKey = (userId: string, reportId: string, nonce: string) => `photos/${userId}/${reportId}/${nonce}.jpg`

export function nonceOf(key: string | null) {
  return key ? (KEY.exec(key)?.[1] ?? null) : null
}

export const photoEtag = (nonce: string) => `"${nonce}"`

// If-None-Match may list several tags, weak or not
export function etagMatches(header: string | null | undefined, etag: string) {
  if (!header) return false
  if (header.trim() === '*') return true
  return header.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)
}

export const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff

/**
 * Walks the JPEG header up to the start of scan. Returns why the photo is refused, or null when it is
 * clean: only APP0 (JFIF) and APP2 (ICC colour profile) are allowed. APP1 (Exif, XMP), APP13 (IPTC) and
 * the other APPn segments can carry location, device and editing data.
 */
export function disallowedSegment(b: Uint8Array): string | null {
  if (!isJpeg(b)) return 'not a JPEG'
  let i = 2
  while (i < b.length) {
    if (b[i] !== 0xff) return 'malformed header'
    // Markers may be padded with any number of 0xFF fill bytes
    while (b[i] === 0xff) i++
    if (i >= b.length) break
    const marker = b[i]
    i++
    if (marker === 0xda) return null // start of scan: the header is over
    if (marker === 0xd9) return 'no image data'
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue // no length
    if (i + 2 > b.length) break
    const length = (b[i] << 8) | b[i + 1]
    if (length < 2) return 'malformed header'
    if (marker >= 0xe0 && marker <= 0xef && marker !== 0xe0 && marker !== 0xe2) {
      return `APP${marker - 0xe0} segment not allowed`
    }
    i += length
  }
  return 'truncated header'
}
