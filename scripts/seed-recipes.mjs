// Loads content/recipes.json into D1: npm run db:seed:local | db:seed:remote
//
// Versions are append-only. If a version already in the database differs from the file (or was
// removed from it), the script stops: publish the change as a new version instead, so reports that
// point at the old version keep meaning what they meant.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RECIPE_CONTENT } from '../src/data.ts'

const target = process.argv[2]
if (target !== '--local' && target !== '--remote') {
  console.error('usage: node scripts/seed-recipes.mjs --local|--remote')
  process.exit(2)
}

const wranglerBin = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url))
const wrangler = (...args) =>
  execFileSync(process.execPath, [wranglerBin, 'd1', 'execute', 'DB', target, ...args], { encoding: 'utf8' })

const q = (s) => `'${String(s).replaceAll("'", "''")}'`
const qn = (s) => (s == null ? 'NULL' : q(s))
// steps are stored as JSON text; null for espresso and archived per-roast filter recipes
const stepsJson = (v) => (v.steps ? JSON.stringify(v.steps) : null)

// 1. Compare with what the database already holds
const [{ results: existing }] = JSON.parse(
  wrangler('--json', '--command', 'SELECT id, dose, yield_g, time_min, time_max, temp_min, temp_max, grind, steps, published_at FROM recipe_versions'),
)
const inFile = new Map(RECIPE_CONTENT.flatMap((e) => e.versions.map((v) => [v.id, v])))
const problems = []
for (const row of existing) {
  const v = inFile.get(row.id)
  if (!v) {
    problems.push(`${row.id} is in the database but no longer in the file`)
    continue
  }
  const same =
    row.dose === v.dose &&
    row.yield_g === v.yield &&
    row.time_min === v.time[0] &&
    row.time_max === v.time[1] &&
    row.temp_min === v.temp[0] &&
    row.temp_max === v.temp[1] &&
    row.grind === (v.grind ?? null) &&
    row.steps === stepsJson(v) &&
    row.published_at === v.publishedAt
  if (!same) problems.push(`${row.id} was changed in the file; add a new version instead`)
}
if (problems.length) {
  console.error(`Refusing to seed (${target.slice(2)}):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

// 2. Upsert recipes (only status may change) and insert new versions
const now = Date.now()
const known = new Set(existing.map((r) => r.id))
const statements = []
for (const e of RECIPE_CONTENT) {
  statements.push(
    `INSERT INTO recipes (slug, method, roast, brewer, status, created_at, updated_at) VALUES (${q(e.slug)}, ${q(e.method)}, ${qn(e.roast)}, ${qn(e.brewer)}, ${q(e.status)}, ${now}, ${now})` +
      ` ON CONFLICT(slug) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at WHERE recipes.status <> excluded.status;`,
  )
  for (const v of e.versions) {
    if (known.has(v.id)) continue
    statements.push(
      `INSERT INTO recipe_versions (id, recipe_slug, version, dose, yield_g, time_min, time_max, temp_min, temp_max, grind, steps, published_at, created_at)` +
        ` VALUES (${q(v.id)}, ${q(e.slug)}, ${v.version}, ${v.dose}, ${v.yield}, ${v.time[0]}, ${v.time[1]}, ${v.temp[0]}, ${v.temp[1]}, ${qn(v.grind)}, ${qn(stepsJson(v))}, ${q(v.publishedAt)}, ${now});`,
    )
  }
}

const dir = mkdtempSync(join(tmpdir(), 'seed-recipes-'))
try {
  const file = join(dir, 'seed.sql')
  writeFileSync(file, statements.join('\n') + '\n')
  wrangler('--file', file)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
const added = [...inFile.keys()].filter((id) => !known.has(id))
console.log(`Seeded ${target.slice(2)}: ${RECIPE_CONTENT.length} recipes, ${added.length} new version(s)${added.length ? `: ${added.join(', ')}` : ''}`)
