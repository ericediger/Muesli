---
record: task-handoff
standard: coordination-v1
task_id: <folder>-<yyyymmdd>-<short-slug>
title: <one line>
folder: <application folder name>
status: unassigned          # unassigned | active | blocked | paused | released | closed
owner:
  tool: <Claude Code | Codex | other>
  session_id: <ID the tool shows, or unknown>
  since: <YYYY-MM-DDTHH:MM±HH:MM>
reviewers: []               # each: tool + session ID, or a person's role. Not the owner.
coordinator: Pasta
project_owner: Eric
released_to: none           # none | any | <tool + session ID>
escalation_pending: false
closed_reason: none         # none | accepted | abandoned | superseded
branch: <branch, or none>
base_branch: <default branch, or none>
worktree: <name or relative location, e.g. main checkout>
latest_commit: <short SHA, or none>
uncommitted_changes: <none, or count and short list>
depends_on: []              # task IDs or named external dependencies
blocks: []                  # task IDs waiting on this one
milestones:
  implementation_complete: no
  verified: no
  ready_for_owner_testing: no
  accepted: no              # Eric only
  merged: no
  deployed: no
updated_at: <YYYY-MM-DDTHH:MM±HH:MM>
updated_by: <tool + session ID>
---

# <task_id>: <title>

<!-- Copy this file to docs/coordination/tasks/<task-id>.md. Write "unknown" for anything you have not confirmed. Use relative paths only. Procedures: docs/coordination/README.md. -->

## Goal

<What this task achieves, in one or two sentences.>

## Acceptance criteria

- <Criterion as Eric stated it, or "unknown, asked on <date>">

## Scope

- **In scope:** <files, modules, documents>
- **Out of scope:** <...>
- **Shared resources touched:** <migrations, schemas, configuration, ports, databases, services; or none>

## Current state

<Three to five sentences: what is true now.>

## Completed

- <Change, with file paths or commit SHAs>

## Remaining

- <Work left>

## Blockers

- <Blocker: what would unblock it, and who can>

## Decisions needed (from Eric)

- <Question, options, recommendation>

## Next step

<The single exact next action, specific enough that another agent could do it.>

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| <tests> | `<command>` | passed / failed / not run | <commit SHA, or "working tree at SHA + uncommitted"> | <timestamp> |

**Verification limits:** <what these checks do not cover>

## Evidence

- <Relative path, commit SHA, PR number or log location for each claim above>

## Discrepancies found on resume

- <Field: recorded value vs observed value, marked stale or unknown. Write "none" if none.>

## Log

<!-- Append only. One line per event: created, claimed, updated, blocked, paused, released, transferred, closed. -->

- <YYYY-MM-DDTHH:MM±HH:MM> · <tool + session ID> · <event> · <one line>
