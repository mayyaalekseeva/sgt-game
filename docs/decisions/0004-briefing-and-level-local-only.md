# 0004. Player level and briefing flag stored on the device only

Status: Accepted (2026-11-03, PR #37)

## Context

On first run the Sargento gives a briefing and asks the player's level (recruit, home, pro). The level
changes the greeting and which missions are listed first.

## Decision

Keep the briefing's `seen` flag and the `level` in the store's localStorage only (`src/briefing.ts`,
`src/store.tsx`), for guests and signed-in players alike. They are not synced and have no D1 column. The
level never changes XP and never hides or locks a feature. A missing or broken saved value means "not
seen, no level". Both can be changed, or the briefing replayed, from Profile.

Why device-only rather than synced: **to verify**. The code states the rule but not the reason. A likely
reason is that the values are cosmetic and do not need a migration or API, but that is not recorded.

## Consequences

- No schema, API or sync change was needed for onboarding.
- A signed-in player on a new device or a cleared browser sees the briefing again and answers the level
  again. Their reports and progress are unaffected.
- Because the level only reorders and greets, two devices with different levels never disagree on progress.
