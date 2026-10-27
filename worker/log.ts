// Drizzle wraps D1 failures as "Failed query: <sql>\nparams: <values>"; the values can be emails,
// Google ids or session hashes, so only the SQL and the underlying D1 error get logged.
const describe = (err: unknown): Record<string, unknown> => {
  if (!(err instanceof Error)) return { error: String(err) }
  return {
    name: err.name,
    message: err.message.split('\nparams:')[0],
    stack: err.stack?.replace(/\nparams:[^\n]*/, ''),
    ...(err.cause !== undefined && { cause: describe(err.cause) }),
  }
}

// One JSON line per error, so Workers Logs can filter on stage
export function logError(stage: string, err: unknown, extra: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ stage, ...extra, ...describe(err) }))
}
