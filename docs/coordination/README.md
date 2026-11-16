# Coordination procedures

> **Standard:** Coordination Standard v1. The rules are in `AGENTS.md` §0; this file covers how to follow them. The record template is [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md).
> This file is the same in every application folder. Project-specific values (default branch, shared runtime resources, standing authorizations) are in `AGENTS.md` §0.9.

## Where things live

| What | Where |
|---|---|
| Shared rules for all agents | `AGENTS.md` §0 |
| Claude-specific guidance | `CLAUDE.md`, which imports `AGENTS.md` |
| Procedures and template | `docs/coordination/` (this folder) |
| Task records, one per task | `docs/coordination/tasks/<task-id>.md`, written in the task's own branch and worktree |
| Session-level summary, where the folder has one | `HANDOFF.md` at the folder root. It links to task records and does not repeat their status. |

**Who writes a record:**
- The task owner writes it.
- Reviewers report findings to the owner, who records them.
- The coordinator reads records and sends changes to the owner. It writes one itself only to open an `unassigned` task, and only in a checkout that no agent is writing in.

**Visibility:** a task record exists where it was written and nowhere else.
- In another checkout, it shows up only once its branch is merged there.
- On GitHub, it shows up only once it is committed and pushed. Both of those need Eric's authorization.
- An uncommitted record exists only in its own worktree folder.

Never assume that a record you can see is the latest one. Folders without git follow the same steps; they record `branch: none` and `latest_commit: none`.

## Task IDs

Format: `<folder>-<yyyymmdd>-<short-slug>`, lowercase. The date is the day the task was created. The folder prefix keeps IDs unique across all application folders. *Fictional example:* `dossier-20261029-pdf-export`.

## Preflight before changing files

Work through these checks before you change any file.

1. **Owner:** the task record names you (tool and session ID) as owner with `status: active`.
2. **Scope:** the change is inside the record's scope. If it isn't, stop and ask.
3. **Branch and worktree:** `git branch --show-current` and `git worktree list` match the record.
4. **Working tree:** everything in `git status --short` belongs to this task. Anything else belongs to someone else, so leave it alone.
5. **Overlap:** search the other open records (see *Finding updates*) for the same files, migrations, schemas or configuration.
6. **Runtime:** before starting servers, running migrations or running tests that write data, check the shared resources in `AGENTS.md` §0.9.

If any check fails or is unclear, don't change files. Note the problem under *Blockers* or *Decisions needed* in the record and tell the coordinator.

## Start a task

1. Confirm the task's goal, scope and acceptance criteria came from Eric, either directly or relayed by the coordinator quoting him. Record anything missing as `unknown` and ask.
2. Check that no record already exists for this task or an overlapping scope.
3. If other implementation tasks are running in this repository, use a separate branch and, where practical, a separate worktree. If your tool creates the worktree for you, record whatever it created.
4. Copy `HANDOFF_TEMPLATE.md` to `tasks/<task-id>.md` and fill in the front matter. Set `status: active`, put yourself as `owner`, and write `updated_at` with its time zone offset.
5. Run the preflight, then add a log line: `created` or `claimed`.

## Update

Update the record:
- at each meaningful milestone
- as soon as you're blocked
- after any test run you'll cite later
- before pausing
- before a transfer

Each time, refresh the front matter (`status`, `latest_commit`, `uncommitted_changes`, `updated_at`, `updated_by`), update the sections that changed, and add one line to the log. The log only grows; never edit old log lines.

## Pause

Set `status: paused`; you keep ownership. Record:
- the exact next step
- which files are uncommitted
- the latest commit
- any servers or processes you left running (prefer stopping them)

**Before you leave a worktree:** make sure nothing exists only there. A worktree that is cleaned up takes its uncommitted files with it, the task record included. Commit the work and the record to the task branch, and confirm from the main checkout that the branch has them. If you can't commit, the worktree has to stay: say so in the record and tell the coordinator.

## Release for the next session

Set `status: released` when another session may pick the task up without waiting for a human:
- `released_to`: a specific tool and session ID, or `any`.
- `escalation_pending: false`.

If a decision from Eric is outstanding, set `status: blocked` and `escalation_pending: true` instead. A blocked task is not released.

The worktree rule under *Pause* applies before you release, too.

## Resume or claim

1. Read the record, then compare it with reality:
   - Does the branch exist, and is it the one checked out?
   - Does `latest_commit` match `git log -1`?
   - Does `uncommitted_changes` match `git status`?
   - Does the worktree reference resolve?
2. Write any mismatch under *Discrepancies found on resume*, marked `stale` or `unknown`. Re-run a test before relying on a "passed" result from an earlier state.
3. **If the task is `released`** to you or to `any`: set yourself as `owner` with `status: active`, and log `claimed from release by <previous owner>`.
4. **If another owner holds it** (`active`, `paused` or `blocked`): stop. Ask the coordinator or Eric. A stale timestamp does not change this.

## Transfer ownership

- **Outgoing owner:**
  1. Bring every field up to date.
  2. Set `status: released` and name the new owner in `released_to`.
  3. Log the transfer.
- **Incoming owner:** follow *Resume or claim*.
- **If the outgoing owner can't do this:** only Eric can reassign the task. Record his decision in the log, quoted and dated.

## Close

- Move the milestones forward as evidence arrives. Only Eric marks `accepted`.
- Set `status: closed` with a `closed_reason`: `accepted`, `abandoned` or `superseded`.
- Keep the file. Closed records are the history.

## Status values

| `status` | Meaning | Who can change it |
|---|---|---|
| `unassigned` | The task exists but has no owner yet | Eric or the coordinator assigns it |
| `active` | The owner is working on it | Owner |
| `blocked` | Can't proceed. See *Blockers* and *Decisions needed* | Owner |
| `paused` | Stopped on purpose; the owner keeps ownership | Owner |
| `released` | Ready for the named or `any` next owner | Owner, or Eric |
| `closed` | Finished, abandoned or superseded | Owner, after Eric decides |

Milestones are separate fields, each `no` or `yes`. A `yes` needs evidence in the record.
- `implementation_complete`: the change is written.
- `verified`: checks ran and passed on a recorded state.
- `ready_for_owner_testing`: Eric can test it.
- `accepted`: Eric accepted it.
- `merged`: it's on the default branch.
- `deployed`: it's live or released.

## Finding updates (coordinator)

These commands only read:

```bash
git worktree list                                    # every checkout of this repository
git -C <worktree> status --short docs/coordination   # uncommitted record changes in that checkout
git branch -a --sort=-committerdate                  # branches, most recent first
git log --all --since=<date> --stat -- docs/coordination/tasks   # committed record changes on any branch known here
git show <branch>:docs/coordination/tasks/<task-id>.md           # read a record on another branch
```

- `git fetch` updates what this checkout knows about GitHub, but GitHub only has what was pushed.
- An open worktree may hold newer, uncommitted record changes than any branch.
- A worktree that a tool removed takes its uncommitted records with it.
- For folders without git, read `docs/coordination/tasks/` directly.

## Privacy checklist for every record

- Use relative paths only. Refer to worktrees by name or relative location, never by an absolute path.
- No personal email addresses, credentials, tokens or `.env` contents.
- No private machine details: usernames, volume names, device IDs.
- No personal or confidential business data. Point to where the evidence lives instead of copying it.

## Format notes

- Front-matter keys are stable and their values plain. That keeps records easy to read now and to ingest later.
- Timestamps are ISO 8601 with an offset, for example `2026-10-29T14:05-04:00`.
- No sync or automation exists yet. Don't build any as part of a task.
