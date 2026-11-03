// Makes the PWA icons in public/icons/ from the kingfisher in public/brand/logo.png (commit the output).
//   node scripts/make-icons.mjs
// sharp is not a dependency of ours: it comes with wrangler (miniflare). If it is ever missing,
// run `npx -p sharp node scripts/make-icons.mjs` or install it without saving.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SAGE = '#9AA784'
const logo = fileURLToPath(new URL('../public/brand/logo.png', import.meta.url))
const dir = new URL('../public/icons/', import.meta.url)
mkdirSync(dir, { recursive: true })
const out = (name) => fileURLToPath(new URL(name, dir))

// The bird sits above the wordmark and its tail runs into the G, so cut above the letters,
// then mask out the "A" under the beak, then trim to the bird.
const top = await sharp(logo).extract({ left: 230, top: 0, width: 480, height: 284 }).png().toBuffer()
const hole = Buffer.from('<svg width="480" height="284"><rect x="298" y="165" width="90" height="110"/></svg>')
const bird = await sharp(await sharp(top).composite([{ input: hole, blend: 'dest-out' }]).png().toBuffer())
  .trim({ threshold: 10 })
  .png()
  .toBuffer()
const { width: bw, height: bh } = await sharp(bird).metadata()

/** The bird centred on a sage square, `width` of the side wide; `radius` rounds the corners. */
async function icon(file, size, width, radius = 0) {
  const w = Math.round(size * width)
  const h = Math.round((w * bh) / bw)
  const mark = await sharp(bird).resize(w, h).toBuffer()
  const bg = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * radius}" fill="${SAGE}"/></svg>`,
  )
  await sharp(bg)
    .composite([{ input: mark, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(out(file))
  console.log(`wrote icons/${file}`)
}

// Maskable: launchers may crop to a circle of 80% of the side, so the bird's diagonal stays inside it.
const diagonal = Math.hypot(bw, bh) / bw
await icon('icon-192.png', 192, 0.78, 0.22)
await icon('icon-512.png', 512, 0.78, 0.22)
await icon('maskable-512.png', 512, 0.74 / diagonal)
// iOS rounds the corners itself and shows transparency as black, so a full square
await icon('apple-touch-icon.png', 180, 0.74)
