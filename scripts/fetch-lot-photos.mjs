// Copies each lot's bag photo from the roaster's Shopify CDN into public/lots/<slug>.webp, resized,
// so the app never hotlinks the shop. Existing files are kept unless --force.
//   node scripts/fetch-lot-photos.mjs [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const WIDTH = 640
const force = process.argv.includes('--force')
const { lots } = JSON.parse(readFileSync(new URL('../content/lots.json', import.meta.url), 'utf8'))
const dir = new URL('../public/lots/', import.meta.url)
mkdirSync(dir, { recursive: true })

for (const lot of lots) {
  if (!lot.photo) continue
  const file = new URL(`${lot.slug}.webp`, dir)
  if (existsSync(file) && !force) {
    console.log(`kept    ${lot.slug}`)
    continue
  }
  const src = new URL(lot.photo)
  src.searchParams.set('width', String(WIDTH))
  // the CDN converts to webp when asked through Accept
  const res = await fetch(src, { headers: { Accept: 'image/webp' } })
  const type = res.headers.get('content-type')
  if (!res.ok || type !== 'image/webp') throw new Error(`${lot.slug}: got ${res.status} ${type} from ${src}`)
  const body = Buffer.from(await res.arrayBuffer())
  writeFileSync(file, body)
  console.log(`fetched ${lot.slug} (${Math.round(body.length / 1024)} KB)`)
}
