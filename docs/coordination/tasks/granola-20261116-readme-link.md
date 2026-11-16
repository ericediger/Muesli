---
record: task-handoff
standard: coordination-v1
task_id: granola-20261116-readme-link
title: Fix the Granola App link in the README title
folder: GRANOLA
status: active
owner:
  tool: Claude Code
  session_id: d7de786c-d1df-48ea-91bb-7c7849d5a6b8
  since: 2026-11-16T16:36-05:00
reviewers: []
coordinator: Pasta
project_owner: Eric
released_to: none
escalation_pending: false
closed_reason: none
branch: granola-20261116-readme-link
base_branch: main
worktree: main checkout
latest_commit: see the branch (this record is part of the commit)
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
updated_at: 2026-11-16T16:37-05:00
updated_by: Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8
---

# granola-20261116-readme-link: Fix the Granola App link in the README title

## Goal

Make "Granola App" in the README title link to https://www.granola.ai/, as Eric asked ("I want this URL to go with 'Granola App'", 2026-11-16).

## Acceptance criteria

- The README title reads "Muesli (A Granola App assistant)", with "Granola App" linked to https://www.granola.ai/.

## Scope

- **In scope:** the first line of `README.md`, this record.
- **Out of scope:** the rest of the README.
- **Shared resources touched:** none.

## Current state

Eric's title edit on GitHub (dc1f7b0) nested one Markdown link inside another, `[Granola App]([url](https://www.granola.ai/))`, which renders as literal brackets. The branch replaces it with `[Granola App](https://www.granola.ai/)`.

## Completed

- `README.md` line 1 fixed.

## Remaining

- Push, pull request and merge: Eric's decisions.

## Blockers

- none

## Decisions needed (from Eric)

- Push the branch and merge the fix.

## Next step

Eric approves the push and merge; the owner pushes, opens a pull request and merges it on Eric's word.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| title renders as a link | `gh api markdown` (GFM) on the old and new first line | passed: old renders plain text with no link; new renders "Granola App" linked to https://www.granola.ai/ | working tree at dc1f7b0 + this change | 2026-11-16T16:37-05:00 |

**Verification limits:** README text only; no code changed, so the app's gates were not re-run.

## Evidence

- `README.md` line 1.

## Discrepancies found on resume

- none

## Log

- 2026-11-16T16:36-05:00 · Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8 · created · task opened at Eric's request; branch cut from main at dc1f7b0 (Eric's title edit).
