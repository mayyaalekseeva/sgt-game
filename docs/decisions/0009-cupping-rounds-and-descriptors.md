# 0009: Cupping in two rounds, with descriptors under each attribute

Status: accepted (2026-11-13)

## Context

Cupping on a phone had one long screen per coffee: every score, then a flavor picker and a notes box at the bottom. Noting
an aroma meant scrolling away from the score. A real cupping also goes in order: the aroma of every cup first, then a break
(break the crust, skim, let the cups cool), then the taste.

## Decision

- A coffee opens in the aroma round (fragrance only) until its fragrance is scored, then in the tasting round. The round is
  part of the route (`<session>.<sample>.aroma|tasting`); the break is `<session>.break`, a checklist and a stopwatch with
  no target time.
- After the last coffee's aroma: the break, or skip it to the first coffee. After the last coffee's tasting: the summary, or
  back to the first coffee.
- Which attribute is in which round is a screen matter (`AROMA_ATTRIBUTES` in src/cupping.ts), not part of the published form.
- Under every attribute: quick descriptors and a note, stored per sample as `details`. The flavor wheel has three tiers
  (family, specific, finer) for fragrance, flavor and aftertaste; the other attributes have a short list. Brew reports keep
  their two-tier flavor ids.
- Defects: one-tap buttons for the common ones (mold, musty, phenolic, rio and others) add a defect row with that name.
- The old whole-cup flavors stay visible only for sessions that have them.

## Consequences

D1 gets one nullable JSON column (`cupping_samples.details`, migration 0014). The server checks the shape only, like the marks.
Tag ids are permanent. The lists are data in src/flavors.ts and src/cupping-descriptors.ts, with labels in both languages.
