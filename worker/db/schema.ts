import { foreignKey, index, integer, primaryKey, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

// Times are epoch ms. Recipe content comes from content/recipes.json via scripts/seed-recipes.mjs;
// XP, rank and missions are derived from reports and passed drills, and never stored.

export const METHODS = ['espresso', 'filter'] as const
export const ROASTS = ['light', 'medium', 'dark'] as const
export const TASTES = ['sour', 'bitter', 'thin', 'balanced'] as const
export const OFF_NOTES = ['green', 'harsh', 'woody'] as const
export const BREWERS = ['v60', 'kalita', 'aeropress', 'frenchpress'] as const
export const GRINDS = ['fine', 'medium_fine', 'medium', 'medium_coarse', 'coarse'] as const
export const PROCESSES = ['washed', 'natural', 'honey', 'anaerobic', 'decaf'] as const
export const VISIBILITIES = ['private', 'public'] as const
export const MAX_PROCESS = 30 // or the player's own words, up to this long (src/coffees.ts)

// A filter recipe step (src/data.ts Step), stored as JSON on its version
export interface StepJson {
  at: number
  kind: string
  to?: number
}

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: integer('created_at').notNull(),
  lastLoginAt: integer('last_login_at').notNull(),
})

// Only the SHA-256 of the session cookie is stored
export const sessions = sqliteTable(
  'sessions',
  {
    idHash: text('id_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

// The slug ("espresso-medium", "filter-v60") is the identity; working recipes are keyed by it.
// Espresso has a roast; filter a brewer (its roast will come from the coffee lot), or a roast if archived.
export const recipes = sqliteTable('recipes', {
  slug: text('slug').primaryKey(),
  method: text('method', { enum: METHODS }).notNull(),
  roast: text('roast', { enum: ROASTS }),
  brewer: text('brewer', { enum: BREWERS }),
  status: text('status', { enum: ['published', 'archived'] }).notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

// Immutable once inserted. id = `${slug}@${version}`, the same id the client stores on a report
export const recipeVersions = sqliteTable(
  'recipe_versions',
  {
    id: text('id').primaryKey(),
    recipeSlug: text('recipe_slug')
      .notNull()
      .references(() => recipes.slug),
    version: integer('version').notNull(),
    dose: real('dose').notNull(),
    yieldG: real('yield_g').notNull(),
    timeMin: integer('time_min').notNull(),
    timeMax: integer('time_max').notNull(),
    tempMin: integer('temp_min').notNull(),
    tempMax: integer('temp_max').notNull(),
    grind: text('grind', { enum: GRINDS }), // brewer recipes only
    steps: text('steps', { mode: 'json' }).$type<StepJson[]>(), // brewer recipes only
    publishedAt: text('published_at').notNull(), // YYYY-MM-DD, as in the content file
    createdAt: integer('created_at').notNull(),
  },
  (t) => [unique('recipe_versions_slug_version').on(t.recipeSlug, t.version)],
)

// id is generated on the client; the composite key keeps ids from different accounts apart
export const reports = sqliteTable(
  'reports',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    ts: integer('ts').notNull(),
    method: text('method', { enum: METHODS }).notNull(),
    roast: text('roast', { enum: ROASTS }),
    brewer: text('brewer', { enum: BREWERS }),
    dose: real('dose').notNull(),
    yieldG: real('yield_g').notNull(),
    time: integer('time').notNull(),
    taste: text('taste', { enum: TASTES }).notNull(),
    diag: text('diag').notNull(),
    recipeVersionId: text('recipe_version_id').references(() => recipeVersions.id),
    lot: text('lot'), // a lot slug from content/lots.json, or `my:<coffee id>`; null on older reports
    grinder: text('grinder'), // the player's grinder setting, free text
    grinderModel: text('grinder_model'), // which grinder, an id from src/grinders.ts; null when not chosen
    notes: text('notes'),
    flavors: text('flavors', { mode: 'json' }).$type<string[]>(), // ids from src/flavors.ts, a JSON array; null when none
    timed: integer('timed', { mode: 'boolean' }).notNull().default(false), // brewed with the brew timer
    photoKey: text('photo_key'), // R2 key photos/<userId>/<reportId>/<nonce>.jpg (worker/photos.ts); null without a photo
    visibility: text('visibility', { enum: VISIBILITIES }).notNull().default('private'), // for later sharing; unused yet
    editedAt: integer('edited_at'), // last edit of grinder, setting or notes, by the client's clock; the later edit wins
    roastedOn: text('roasted_on'), // YYYY-MM-DD the brewed bag was roasted; null when not given
    offNote: text('off_note', { enum: OFF_NOTES }), // a flavor noticed besides the taste; null when none
    importedAt: integer('imported_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('reports_user_ts_idx').on(t.userId, t.ts)],
)

// Ids of deleted reports, nothing else: the report itself is gone, and a late retry of its POST is ignored
export const deletedReports = sqliteTable(
  'deleted_reports',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    deletedAt: integer('deleted_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
)

// One per recipe and coffee. lot is '' for working recipes from before coffees (part of the key, so not null)
export const workingRecipes = sqliteTable(
  'working_recipes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipeSlug: text('recipe_slug')
      .notNull()
      .references(() => recipes.slug),
    lot: text('lot').notNull().default(''),
    reportId: text('report_id').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.recipeSlug, t.lot] }),
    foreignKey({ columns: [t.userId, t.reportId], foreignColumns: [reports.userId, reports.id] }).onDelete('cascade'),
  ],
)

// Coffees a player added (any roaster's bag). Reports name them as `my:<id>`. The client makes the id,
// and the later updated_at wins, so a repeated or out-of-order send changes nothing.
export const coffees = sqliteTable(
  'coffees',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    roaster: text('roaster').notNull(),
    origin: text('origin').notNull(),
    process: text('process').notNull(), // one of PROCESSES, or free text
    roast: text('roast', { enum: ROASTS }).notNull(),
    name: text('name'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    roastedOn: text('roasted_on'), // YYYY-MM-DD from the bag
    updatedAt: integer('updated_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
)

// Same list as the client's DRILL_IDS (src/drills.ts)
export const DRILL_IDS = ['one-change', 'extraction', 'grind-time', 'ratio', 'channeling'] as const

// A drill's field test, passed. The first pass is kept and never changes; XP and rank are derived from it on the
// client, like missions from reports.
export const drillPasses = sqliteTable(
  'drill_passes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    drillId: text('drill_id', { enum: DRILL_IDS }).notNull(),
    passedAt: integer('passed_at').notNull(), // by the client's clock
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.drillId] })],
)

// Cupping sessions (src/cuppings.ts), based on the SCA cupping form. A session is edited many times while it is a
// draft: the client makes the id and the later updated_at wins, as with coffees. Deleting keeps the row as a
// tombstone (deleted_at set, the rest cleared) so a late retry of an older copy cannot bring it back.
export const CUPPING_STATUSES = ['draft', 'done'] as const

export const cuppingSessions = sqliteTable(
  'cupping_sessions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    day: text('day').notNull(), // YYYY-MM-DD it was cupped
    place: text('place'),
    protocol: text('protocol'), // the player's protocol notes (water, ratio, grind...)
    blind: integer('blind', { mode: 'boolean' }).notNull().default(false),
    revealed: integer('revealed', { mode: 'boolean' }).notNull().default(false), // blind names shown
    status: text('status', { enum: CUPPING_STATUSES }).notNull().default('draft'),
    updatedAt: integer('updated_at').notNull(), // by the client's clock
    deletedAt: integer('deleted_at'), // a tombstone when set
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
)

// The coffees cupped in a session, replaced as a whole with each newer copy of the session. Marks follow the form
// named by form_id (src/cupping.ts FORMS), as JSON, so a new form needs no migration.
export const cuppingSamples = sqliteTable(
  'cupping_samples',
  {
    userId: text('user_id').notNull(),
    sessionId: text('session_id').notNull(),
    id: text('id').notNull(),
    position: integer('position').notNull(),
    lot: text('lot'), // a lot slug or `my:<coffee id>`; null for a coffee not in the app
    code: text('code'), // the blind code on the cup ("A", "317")
    formId: text('form_id').notNull(),
    cupCount: integer('cup_count').notNull(),
    scores: text('scores', { mode: 'json' }).notNull().$type<Record<string, number>>(),
    cups: text('cups', { mode: 'json' }).notNull().$type<Record<string, boolean[]>>(),
    defects: text('defects', { mode: 'json' }).notNull().$type<{ kind: string; cups: number; flavor?: string }[]>(),
    flavors: text('flavors', { mode: 'json' }).$type<string[]>(), // ids from src/flavors.ts; null when none
    notes: text('notes'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.sessionId, t.id] }),
    foreignKey({ columns: [t.userId, t.sessionId], foreignColumns: [cuppingSessions.userId, cuppingSessions.id] }).onDelete('cascade'),
  ],
)
