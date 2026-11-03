# 0007. Celebration moments come from the player's own actions, remembered on the device

Status: Accepted (2026-11-03, branch feat/moments)

## Context

A promotion, a passed drill field test and a completed mission each get a short moment on screen. Progress
is derived, never stored (0003), and it can change without the player doing anything here: a sync brings in
reports from another device, a reload recomputes everything, a deleted report takes XP away.

## Decision

Find moments with a pure function (`momentsFor` in `src/moments.ts`) that compares progress before and after
an action, and call it only from the player's own actions in `src/reports.tsx`: filing a report, marking a
working recipe (missions m5, m10 and m11 complete that way) and passing a field test. A sync or a reload
never calls it. Each event has an id (`rank:cabo`, `drill:ratio`, `mission:m3`); once queued, the id is kept
in localStorage under `barista-game:celebrated:<account id or guest>`, and an id there is never shown again.
Nothing is added to D1, the API or the sync.

Moments wait in a queue while a brew timer runs or the timer screen is open (`showMoments`), and while
the briefing is open. They never take focus or block the screen: only the card takes taps.

## Consequences

- A moment earned on one device is not shown on another, even the first time that device sees the progress.
- A rank lost by deleting reports and earned again is not celebrated twice on the same device.
- Clearing the browser forgets the celebrated ids, but nothing replays until a new action earns something.
- The debrief (`Gains`) still shows what a report earned. The moment adds to it and replaces nothing.
