import { foreignKey, index, integer, primaryKey, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

// Times are epoch ms. Recipe content comes from content/recipes.json via scripts/seed-recipes.mjs;
// XP, rank and missions are derived from reports and never stored.

export const METHODS = ['espresso', 'filter'] as const
export const ROASTS = ['light', 'medium', 'dark'] as const
export const TASTES = ['sour', 'bitter', 'thin', 'balanced'] as const

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

// The slug ("espresso-medium") is the identity; working recipes are keyed by it
export const recipes = sqliteTable('recipes', {
  slug: text('slug').primaryKey(),
  method: text('method', { enum: METHODS }).notNull(),
  roast: text('roast', { enum: ROASTS }).notNull(),
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
    roast: text('roast', { enum: ROASTS }).notNull(),
    dose: real('dose').notNull(),
    yieldG: real('yield_g').notNull(),
    time: integer('time').notNull(),
    taste: text('taste', { enum: TASTES }).notNull(),
    diag: text('diag').notNull(),
    recipeVersionId: text('recipe_version_id').references(() => recipeVersions.id),
    importedAt: integer('imported_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('reports_user_ts_idx').on(t.userId, t.ts)],
)

export const workingRecipes = sqliteTable(
  'working_recipes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipeSlug: text('recipe_slug')
      .notNull()
      .references(() => recipes.slug),
    reportId: text('report_id').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.recipeSlug] }),
    foreignKey({ columns: [t.userId, t.reportId], foreignColumns: [reports.userId, reports.id] }).onDelete('cascade'),
  ],
)
