---
record: task-handoff
standard: coordination-v1
task_id: granola-20261116-publish-github
title: Remove real meeting details and publish Muesli to its public GitHub repository
folder: GRANOLA
status: active
owner:
  tool: Claude Code
  session_id: 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d
  since: 2026-11-16T13:55-05:00
reviewers: []
coordinator: Pasta
project_owner: Eric
released_to: none
escalation_pending: false
closed_reason: none
branch: main
base_branch: none (first commit in the repository)
worktree: main checkout
latest_commit: pending (initial commit not made yet)
uncommitted_changes: whole project, before the initial commit
depends_on: []
blocks: []
milestones:
  implementation_complete: yes
  verified: yes             # gates and name/secret scans below
  ready_for_owner_testing: no
  accepted: no
  merged: no
  deployed: no              # pushed: pending
updated_at: 2026-11-16T14:01-05:00
updated_by: Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d
---

# granola-20261116-publish-github: Remove real meeting details and publish Muesli to its public GitHub repository

## Goal

Publish the project to `github.com/ericediger/Muesli` (public, empty when checked), with no personal data, keys or real meeting content in any commit.

## Acceptance criteria

- Eric gave the repository URL, then answered "Yes, clean and publish" (2026-11-16) to this plan:
  - Replace every real name, company, email and meeting title with made-up ones.
  - Keep `.mcp.json` out of the repository.
  - `git init`, then make the first commit on `main`.
  - Push `main`, then record the default branch in `AGENTS.md`.
- Committing on `main` instead of a task branch is Eric's explicit decision for the initial import, because the repository was empty.

## Scope

- **In scope:** made-up names in `test/people.test.ts`, `test/store.test.ts`, `test/format.test.ts`, `test/client.test.ts`, `src/people/people.ts` (comments), `README.md`, `USE-CASES.md` and `web/app.js` (placeholders); `.gitignore` (`.mcp.json`); `AGENTS.md` §0.9 (default branch, repository, push rule); `git init`; the initial commit; the push.
- **Out of scope:** a license (Eric has not chosen one); the CLI name; the folder name.
- **Shared resources touched:** the GitHub remote.

## Current state

The real names are replaced, and the scans are clean. The git repository is not created yet.

## Completed

- Made-up replacements, used consistently:
  - People: Dana Whitfield, Priya Raman, Marco Reyes, Hannah Cole, Amy DeLuca, Mary Kate Holm, Greta.
  - Companies: Wingtip, Northwind, Contoso, BrightPath, Skyline Labs, Tailspin.
  - Folder: BLUEBIRD. Emails: `example.com`.
  - The owner's test name is "Eric Lund".
  - A real note ID in the format tests became `not_1d3tmExample01`.
- `.gitignore` excludes `.mcp.json`.
- `AGENTS.md` §0.9 records `main`, the repository, and "ask before each push" (the repository is public).

## Remaining

- `git init`, review the staged files, commit, push, then update this record with the commit and push results.

## Blockers

- none

## Decisions needed (from Eric)

- License: none yet. Without one, others may read the code but have no right to reuse it.

## Next step

Initial commit on `main`, then push.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | passed | working tree | 2026-11-16T13:59-05:00 |
| tests | `npm test` | passed (19/19) | working tree | 2026-11-16T13:59-05:00 |
| files to publish | `git ls-files --others --exclude-standard` with a throwaway git dir outside the project | 57 files; no `data/`, `.env`, `.mcp.json`, `dist/` or `node_modules/` | working tree | 2026-11-16T13:59-05:00 |
| real names | scratch scan: names, attendee names, email domains and title words from the local archive index, matched against the files to publish | passed (only the owner's first name and common words match) | working tree | 2026-11-16T13:59-05:00 |
| keys, paths, emails | grep for key patterns, absolute home paths and email addresses | passed (only placeholder keys and made-up `example` / `x.com` addresses) | working tree | 2026-11-16T13:59-05:00 |
| GitHub identity | `git config user.email` | GitHub no-reply address | machine config | 2026-11-16T13:52-05:00 |

**Verification limits:** the name scan only covers names found in the archive index (titles, attendees, speaker tags). Text of other kinds was reviewed by reading the matched lines.

## Evidence

- Eric's approval in chat, 2026-11-16: "Yes, clean and publish".

## Discrepancies found on resume

- none

## Log

- 2026-11-16T13:55-05:00 · Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d · created · preflight: repository public and empty, gh signed in, no-reply commit email; real names found in tests, docs and placeholders; asked Eric before git init and push
- 2026-11-16T14:01-05:00 · Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d · updated · Eric approved; names replaced; gates and scans passed; ready for the initial commit
