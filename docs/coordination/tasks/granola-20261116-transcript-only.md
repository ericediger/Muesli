---
record: task-handoff
standard: coordination-v1
task_id: granola-20261116-transcript-only
title: Ask and Profiles use transcripts only, profiles include group meetings, .env edits apply live
folder: GRANOLA
status: active
owner:
  tool: Claude Code
  session_id: 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d
  since: 2026-11-16T13:35-05:00
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
  verified: yes             # gates, live .env reload check and browser checks below
  ready_for_owner_testing: yes
  accepted: no
  merged: no
  deployed: yes             # running in the local GUI service on port 4747 after a restart
updated_at: 2026-11-16T13:41-05:00
updated_by: Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d
---

# granola-20261116-transcript-only: Ask and Profiles use transcripts only, profiles include group meetings, .env edits apply live

## Goal

Match how Eric uses the app: Ask and Profiles read meeting transcripts only, profile auto-detection covers every meeting with the person, and the Settings page clearly works from `.env`.

## Acceptance criteria

Eric's requests (2026-11-16):
1. Ask page: content is transcripts only, with no AI summary or private notes.
2. Profiles page: the same.
3. Remove "Include group meetings (auto-detect)" and make including group meetings the default, because the transcripts cover every meeting.
4. Question: are keys stored in Settings rather than read from `.env`, and why aren't all keys shown? Answer: Settings reads and writes `.env` and has no store of its own, and all four API keys are shown. The real gap was that hand edits to `.env` reached the running GUI only after a restart. That is fixed, and the Settings wording now says where keys live.

Interpretations, not stated by Eric:
- The CLI follows the GUI. `ask` and `profile` default to `--content transcript` but keep the option. `profile` replaces `--include-group` with `--no-group` (one-on-ones only).
- Export keeps its Content select, because Eric did not mention it.

## Scope

- **In scope:** `web/app.js` (Ask, Profiles, Settings wording, Overview line), `src/server.ts` (Ask and Profile defaults, `.env` reload per request), `src/config.ts` (`reloadEnvIfChanged`), `src/corpus/format.ts` (fallback parameter), `src/services/ask.ts`, `src/services/profile.ts`, `src/commands/ask.ts`, `src/commands/profile.ts`, `src/prompts/profile.ts` (one line of synthesis wording), `test/format.test.ts`, `README.md`, `USE-CASES.md`.
- **Out of scope:** Export content options; the model picker (task `granola-20261116-model-picker`); saved model defaults.
- **Overlap check:** `granola-20261116-model-picker` (same owner, active) also touched `web/app.js`, `src/server.ts`, `src/config.ts` and `README.md`. The two tasks change different parts of those files, and both sets of changes are in the working tree together.
- **Shared resources touched:** GUI server on port 4747 (restarted). `.env` was edited briefly by the reload check and restored byte for byte (see Verification).

## Current state

Ask and Profiles send only transcripts, and their Content controls are gone. Ask also lost the private-notes checkbox. Profile auto-detection includes group meetings, and its checkbox is gone. The server applies hand edits to `.env` on the next API request and resets LLM clients when it does. Settings says that it reads and writes `.env`.

## Completed

- Transcript-only defaults: `src/corpus/format.ts` (`normalizeContentMode(v, fallback)`), `src/services/ask.ts`, `src/services/profile.ts`, `src/server.ts`, `src/commands/ask.ts`, `src/commands/profile.ts`.
- Group meetings by default: `src/services/profile.ts` (`includeGroup` false means one-on-ones only), `src/server.ts`, `src/commands/profile.ts` (`--no-group`), `src/prompts/profile.ts`.
- GUI: `web/app.js`, covering Ask (Content select and private-notes checkbox removed), Profiles (Content select and group checkbox removed, wording updated), the Settings lead and "Remove from .env" links, and the Overview line.
- Live `.env` reload: `src/config.ts` (`reloadEnvIfChanged`; shell variables still take precedence) and `src/server.ts` (called at the start of each API request).
- Docs and tests: `README.md`, `USE-CASES.md`, `test/format.test.ts`.

## Remaining

- none

## Blockers

- none

## Decisions needed (from Eric)

- One existing profile was built with transcripts plus notes. Its cached evidence is stored per content mode, so the next build for that person re-extracts every meeting once (one model call per meeting).

## Next step

Eric tests Ask and Profiles in the GUI.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | passed | working tree | 2026-11-16T13:40-05:00 |
| tests | `npm test` | passed (19/19) | working tree | 2026-11-16T13:40-05:00 |
| hand edit to `.env` applies live | scratch script: change ME_NAME to a marker, read `/api/status`, restore the file | passed (marker seen; original value back; file identical byte for byte) | GUI service after restart | 2026-11-16T13:37-05:00 |
| Ask page | browser: no Content select or private-notes checkbox; preview reports content `transcript` | passed | GUI service after restart | 2026-11-16T13:38-05:00 |
| Profiles page | browser: no Content select or group checkbox; preview with no options sent returns content `transcript` and includes group meetings (42 meetings for the top person, against 27 one-on-ones only) | passed | GUI service after restart | 2026-11-16T13:39-05:00 |
| console | browser console errors on Ask and Profiles | none | GUI service after restart | 2026-11-16T13:39-05:00 |

**Verification limits:** no Ask question or profile build was run against a model.

## Evidence

- Eric's requests in chat, 2026-11-16.

## Discrepancies found on resume

- none

## Log

- 2026-11-16T13:35-05:00 · Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d · created · task opened from Eric's requests in chat; preflight: not a git repo; overlap with granola-20261116-model-picker noted (same owner)
- 2026-11-16T13:41-05:00 · Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d · updated · implementation complete; gates passed; GUI service restarted; browser and .env reload checks passed
