---
record: task-handoff
standard: coordination-v1
task_id: granola-20261116-rename-muesli
title: Rename the app from Granola Assistant to Muesli
folder: GRANOLA
status: active
owner:
  tool: Claude Code
  session_id: 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d
  since: 2026-11-16T13:46-05:00
reviewers: []
coordinator: Pasta
project_owner: Eric
released_to: none
escalation_pending: false
closed_reason: none
branch: none
base_branch: none
worktree: main checkout (not a git repository)
latest_commit: none
uncommitted_changes: not a git repository; files listed under Completed
depends_on: []
blocks: []
milestones:
  implementation_complete: yes
  verified: yes
  ready_for_owner_testing: yes
  accepted: no
  merged: no
  deployed: yes             # running in the local GUI service on port 4747 after a restart
updated_at: 2026-11-16T13:50-05:00
updated_by: Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d
---

# granola-20261116-rename-muesli: Rename the app from Granola Assistant to Muesli

## Goal

Give the app the name Eric chose, Muesli, everywhere a person sees the app name.

## Acceptance criteria

- Eric chose "Muesli" from suggested names (2026-11-16).
- The GUI title, sidebar name, README, start-up file and server log say Muesli.
- Kept on purpose: the CLI command `granola` (`npm run granola -- …`, `.name("granola")`), the project folder name, and the LaunchAgent label `local.granola-assistant`. The LaunchAgent label is internal. Changing it would mean unloading and reloading the agent, and the user-facing rename does not need that.

## Scope

- **In scope:** `web/index.html`, `src/server.ts` (startup log line), `src/services/profile.ts` (profile footer), `package.json` and `package-lock.json` (package name only), `README.md`, `AGENTS.md` (project description line only), and the start-up file, renamed to `Start Muesli.command`.
- **Out of scope:** CLI command name, folder name, LaunchAgent label, existing profile files (their footers keep the old name).
- **Overlap check:** `granola-20261116-model-picker` and `granola-20261116-transcript-only` (same owner, active) touch `README.md`, `src/server.ts` and `src/services/profile.ts`, in other lines.
- **Shared resources touched:** GUI server on port 4747 (restarted).

## Current state

The app shows as Muesli in the browser tab and sidebar. The start-up file is now `Start Muesli.command`. The LaunchAgent runs `src/server.ts` directly, so the rename does not affect it.

## Completed

- `web/index.html`, `src/server.ts`, `src/services/profile.ts`, `package.json`, `package-lock.json`, `README.md`, `AGENTS.md`, `Start Muesli.command` (renamed from `Start Granola Assistant.command`, with its messages updated).

## Remaining

- none

## Blockers

- none

## Decisions needed (from Eric)

- none

## Next step

Eric checks the app. Any Dock or desktop shortcut to the old start-up file needs re-creating.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| no old name left (outside task records, data and node_modules) | `grep -rni "granola assistant\|granola-assistant"` | passed (no matches) | working tree | 2026-11-16T13:49-05:00 |
| start-up file syntax | `bash -n "Start Muesli.command"` | passed | working tree | 2026-11-16T13:49-05:00 |
| typecheck | `npm run typecheck` | passed | working tree | 2026-11-16T13:49-05:00 |
| tests | `npm test` | passed (19/19) | working tree | 2026-11-16T13:49-05:00 |
| GUI | browser: tab title and sidebar show Muesli, no console errors | passed | GUI service after restart | 2026-11-16T13:50-05:00 |

**Verification limits:** the start-up file was syntax-checked, not double-clicked.

## Evidence

- Eric's choice in chat, 2026-11-16.

## Discrepancies found on resume

- none

## Log

- 2026-11-16T13:46-05:00 · Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d · created · task opened from Eric's choice in chat; preflight: not a git repo; overlap with two same-owner tasks noted
- 2026-11-16T13:50-05:00 · Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d · updated · rename complete; gates passed; GUI service restarted and checked
