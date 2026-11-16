---
record: task-handoff
standard: coordination-v1
task_id: granola-20261116-gui-glitches
title: Fix grid card offset and the streaming cursor that returns after an answer
folder: GRANOLA
status: active
owner:
  tool: Claude Code
  session_id: d7de786c-d1df-48ea-91bb-7c7849d5a6b8
  since: 2026-11-16T16:03-05:00
reviewers: []
coordinator: Pasta
project_owner: Eric
released_to: none
escalation_pending: false
closed_reason: none
branch: granola-20261116-gui-glitches
base_branch: main
worktree: main checkout
latest_commit: see the branch (pushed; pull request #3)
uncommitted_changes: none from this task after the commit
depends_on: []
blocks: []
milestones:
  implementation_complete: yes
  verified: yes             # see Verification
  ready_for_owner_testing: yes
  accepted: no
  merged: no
  deployed: no
updated_at: 2026-11-16T16:30-05:00
updated_by: Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8
---

# granola-20261116-gui-glitches: Fix grid card offset and the streaming cursor that returns after an answer

## Goal

Fix two display bugs found while filming the explainer (granola-20261116-explainer-video), as Eric asked ("Do this task here: Fix two small Muesli GUI glitches", 2026-11-16).

## Acceptance criteria

- Cards in a `.grid` row line up at the top (Overview's stat cards and its Sync/Connections cards).
- After a streamed Ask answer or profile build finishes, no typing cursor remains and the Ask usage line stays visible, even when animation frames are delayed.
- `npm run typecheck` and `npm test` pass.

## Scope

- **In scope:** `web/style.css`, `web/app.js`, this record.
- **Out of scope:** the server, the CLI, everything else in `web/`.
- **Shared resources touched:** none. Checks run on a static copy of `web/` with a mocked API on its own port, not the GUI service on port 4747 (which is running).

## Current state

Both fixes are written, verified against the old code on a mocked copy of the GUI, committed, pushed, and in pull request #3. Waiting for Eric to test and merge.

## Completed

- `web/style.css`: `.grid > .card + .card { margin-top: 0; }`, so grid cells line up; stacked cards outside grids keep their 14 px gap.
- `web/app.js`: the Ask answer's animation-frame render returns early once `turn.pending` is false; the profile build tracks a `finished` flag set on `done`, `error` and a thrown stream, and its frame render skips once finished. A failed profile stream now also redraws the text without the cursor.

## Remaining

- Eric merges pull request #3 (his decision).
- Eric checks the GUI after restarting his running service (port 4747 still serves the old files until the browser reloads them).

## Blockers

- none

## Decisions needed (from Eric)

- Push and pull request: done (Eric said "Push and open PR").
- Merge pull request #3.

## Next step

Eric reviews and merges pull request #3, or tells the owner to merge it.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | passed | working tree at 580d8e6 + this task's changes | 2026-11-16T16:07-05:00 |
| tests | `npm test` | passed (19/19) | same | 2026-11-16T16:07-05:00 |
| grid alignment | built-in browser, mocked copy of `web/` (old vs new): card tops on Overview, card margins on Settings | old 108/122/122 and 272/286 px; new 108/108/108 and 258/258; Settings' stacked cards keep 14 px | same | 2026-11-16T16:06-05:00 |
| late frame after done (Ask) | same copy; animation frames held, whole stream delivered, frames released after done | old: cursor back, usage line gone; new: no cursor, usage line kept | same | 2026-11-16T16:06-05:00 |
| late frame after done (Profiles) | same method | old: cursor back; new: no cursor, text intact | same | 2026-11-16T16:06-05:00 |
| cursor while streaming (Ask) | same method, stream left open | new: cursor shows mid-answer, gone after done | same | 2026-11-16T16:06-05:00 |

**Verification limits:** checked on a static copy of `web/` with a mocked API (the explainer's fictional data), not on the running GUI with real data. Timer-driven streaming could not be watched live because the browser pane was hidden, so the race was reproduced by holding animation frames instead.

## Evidence

- Pull request #3; commit e5658d1.

## Discrepancies found on resume

- none

## Log

- 2026-11-16T16:03-05:00 · Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8 · created · task opened at Eric's request; branch cut from main. Overlap check: the explainer task's stage copies `web/` but changes no file in it.
- 2026-11-16T16:08-05:00 · Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8 · updated · both fixes written and verified; gates passed; committed on the task branch under the standing authorization. Push waits for Eric.
- 2026-11-16T16:30-05:00 · Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8 · updated · Eric said "Push and open PR"; pushed the branch and opened pull request #3.
