// Report photos are resized and re-encoded here before upload: a canvas re-encode keeps only the pixels,
// so Exif (location, device) never leaves the phone. The server refuses any JPEG that still has metadata.

import { stripDisallowed } from '../worker/photos'

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

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

// createImageBitmap applies the Exif rotation with imageOrientation 'from-image'. Browsers that refuse the
// option, or the file, get a second try through <img>, which also honours the rotation.
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
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
    // HEIC on Android, for one
    throw new PhotoError('unreadable')
  } finally {
    URL.revokeObjectURL(url)
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
    // Safari adds an Exif block (colour space and size only) that the server would refuse
    const clean = new Blob([stripDisallowed(new Uint8Array(await blob.arrayBuffer()))], { type: 'image/jpeg' })
    if (clean.size > MAX_UPLOAD_BYTES) throw new PhotoError('too_big')
    return clean
  } finally {
    img.close()
  }
}
