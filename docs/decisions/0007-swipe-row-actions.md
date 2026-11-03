# 0007. Swipe a row left for its action, as a touch-only shortcut

Status: Accepted (2026-11-03)

## Context

Deleting a cupping session, a coffee on the table or a diary report meant opening it and finding a button at
the bottom (or behind the diary's edit pencil). On a phone, people expect to swipe a list row left to delete it.
A gesture is hidden, though, and a mouse, a keyboard or a screen reader cannot use it.

## Decision

`src/screens/SwipeRow.tsx` wraps a list row. A touch or pen swipe to the left slides the row over and shows one
action; tapping it does the action. Used on:

- Profile > Cupping, the sessions: **Delete** (also forgets this browser's draft of the session, `discardDraft`)
- a session's coffees on the table: **Remove**
- Diary reports: **Delete** (off while the report is being edited)
- My coffees: **Finished**, or **Restore** for a finished bag. Coffees are never deleted, since reports name them.

- The swipe and then the tap are two deliberate steps, so they replace the `window.confirm` that the in-screen
  buttons still ask.
- Mouse input is ignored, so desktop and text selection are unchanged. A mostly vertical drag scrolls the page
  (`touch-action: pan-y`). One row is open at a time, and a tap anywhere else, or on the open row, closes it.
- The action is never in the tab order. The existing buttons in each item's own screen stay, for discoverability
  and for keyboard and screen-reader users.

## Consequences

- There is no undo: a swipe delete goes to the outbox at once, like the in-screen delete.
- A new list whose rows can be removed should use `SwipeRow` and keep an in-screen button too.
- Every wrapped row sits on cream. A row on another background needs its own background, or the action shows
  through it.
