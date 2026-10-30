import { getTableColumns, type Table } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export const db = (env: Env) => drizzle(env.DB, { schema })
export type Db = ReturnType<typeof db>

// D1 binds at most 100 parameters per statement
export const D1_MAX_PARAMS = 100

/**
 * Rows per multi-row INSERT. Drizzle binds up to one parameter per column, column defaults included, so the
 * count follows the table: adding a column cannot push a batch over D1's limit.
 */
export const rowsPerInsert = (table: Table) => Math.floor(D1_MAX_PARAMS / Object.keys(getTableColumns(table)).length)
