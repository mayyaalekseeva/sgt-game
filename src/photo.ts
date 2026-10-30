// Report photos are resized and re-encoded here before upload: a canvas re-encode keeps only the pixels,
// so Exif (location, device) never leaves the phone. The server refuses any JPEG that still has metadata.

export const MAX_EDGE = 1600
// Larger files are refused before decoding: a phone tab can run out of memory on the full-size bitmap
export const MAX_INPUT_BYTES = 30 * 1024 * 1024
// Same as the server (worker/photos.ts MAX_PHOTO_BYTES)
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
export const TARGET_BYTES = 900 * 1024
export const QUALITIES = [0.82, 0.7, 0.6]

export class PhotoError extends Error {
  constructor(readonly code: 'too_big' | 'unreadable') {
    super(`photo: ${code}`)
  }
}

/** The size to draw at: the longest edge at most `max`, never enlarged. */
export function fitWithin(width: number, height: number, max = MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Encodes at each quality in turn and keeps the first result under the target, else the last one. */
export async function encodeWithin(encode: (quality: number) => Promise<Blob>, qualities = QUALITIES, target = TARGET_BYTES) {
  let blob: Blob | null = null
  for (const q of qualities) {
    blob = await encode(q)
    if (blob.size <= target) break
  }
  if (!blob) throw new Error('encodeWithin: no qualities')
  return blob
}

// HEIF brands (ISO/IEC 23008-12) for HEVC-coded photos, as iPhones write them. AVIF is left out: browsers
// decode it themselves, and the decoder below is built without AV1.
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])

/** Whether a file's first bytes are a HEIC/HEIF photo: an ftyp box naming a HEIF brand, major or compatible. */
export function isHeicHeader(b: Uint8Array) {
  const text = (at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3])
  if (b.length < 16 || text(4) !== 'ftyp') return false
  const size = Math.min(((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0, b.length)
  const major = text(8)
  if (major === 'avif' || major === 'avis') return false // AVIF also lists mif1
  if (HEIC_BRANDS.has(major)) return true
  // after the major brand and its minor version, the compatible brands run to the end of the box
  for (let at = 16; at + 4 <= size; at += 4) if (HEIC_BRANDS.has(text(at))) return true
  return false
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

const fromBitmap = (bitmap: ImageBitmap): Decoded => ({ source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() })

// createImageBitmap applies the Exif rotation with imageOrientation 'from-image'. Browsers that refuse the
// option, or the file, get a second try through <img>, which also honours the rotation. An iPhone's HEIC that
// the browser cannot open (Chrome on Windows or Android) is decoded by libheif, loaded only then.
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      return fromBitmap(await createImageBitmap(file, { imageOrientation: 'from-image' }))
    } catch {
      /* try <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} }
  } catch {
    /* try HEIC */
  } finally {
    URL.revokeObjectURL(url)
  }
  if (!isHeicHeader(new Uint8Array(await file.slice(0, 64).arrayBuffer()))) throw new PhotoError('unreadable')
  try {
    // the build without eval, so a Content-Security-Policy cannot break it; about 3 MB, in its own chunk
    const { heicTo } = await import('heic-to/csp')
    // libheif applies the photo's rotation and mirroring itself
    return fromBitmap(await heicTo({ blob: file, type: 'bitmap' }))
  } catch (err) {
    console.warn(err)
    throw new PhotoError('unreadable')
  }
}

/** Any image the browser can open -> a JPEG at most 1600 px on its longest edge, with no metadata. */
export async function compressPhoto(file: Blob): Promise<Blob> {
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError('too_big')
  const img = await decode(file)
  try {
    const { width, height } = fitWithin(img.width, img.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new PhotoError('unreadable')
    // JPEG has no transparency: a transparent PNG would otherwise turn black
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img.source, 0, 0, width, height)
    const blob = await encodeWithin(
      (q) => new Promise<Blob>((done, fail) => canvas.toBlob((b) => (b ? done(b) : fail(new PhotoError('unreadable'))), 'image/jpeg', q)),
    )
    if (blob.size > MAX_UPLOAD_BYTES) throw new PhotoError('too_big')
    return blob
  } finally {
    img.close()
  }
}
