# 0003. XP and rank derived from reports, never stored

Status: Accepted (2026-10-26, initial commit; drills added to it 2026-10-30)

## Context

Progress (XP, rank, missions, drill assignments) comes from what the player brews. Reports can be filed
offline, synced later, re-sent, and deleted. Guests keep reports in localStorage and signed-in players in D1.

## Decision

Compute progress from reports and passed drill field tests every time, with `progressFor` in
`src/progress.ts`. XP, rank and mission totals are never stored, in D1 or on the device (comment in
`worker/db/schema.ts`). Only the inputs are stored: reports, and drill passes (`drill_passes`, migration
`0010`).

## Consequences

- No counter can drift from the reports. Re-sending a report is a no-op (ids come from the client), and
  a deleted report takes its XP with it.
- Guest and signed-in progress use the same code. Only the source of the reports differs.
- After filing, a report's dose, yield, time, taste, off-note, roast date and diagnosis cannot change,
  because progress is derived from them. Only the grinder and notes can be edited (CLAUDE.md).
- Changing the XP rules re-scores past brews too. Whether that is intended is **to verify**.
- Progress is recomputed on each load. That is cheap at the current number of reports per player. The
  cost at a much larger history is **to verify**.
- The debrief compares two snapshots (`gainsFor`) to show what a brew just earned.
