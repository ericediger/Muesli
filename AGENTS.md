# AGENTS.md — GRANOLA

Muesli: a local web GUI and CLI giving API-level access to Granola meeting notes. Setup, commands and privacy notes are in `README.md` and `USE-CASES.md`.

## 0) Coordination Standard v1

<!-- coordination-standard:v1:begin. Keep this block identical in every application folder. Put project-specific values in §0.9. -->

These rules apply to every coding agent working in this folder: Claude Code, Codex, or any other tool. Procedures and the task record format are in [`docs/coordination/README.md`](docs/coordination/README.md). Nothing in this section grants permission for an action (see §0.7).

### 0.1 Roles

- **Project owner (Eric):** decides priority, scope, acceptance, how agent teams or subagents are deployed, and every authorization in §0.7.
- **Coordinator (Pasta):** tracks status, dependencies and handoffs across tasks and folders. Relays Eric's decisions but does not make them. Reads task records and sends changes to their owners. Writes a record itself only to open an `unassigned` task, and only in a checkout that no agent is writing in.
- **Task owner:** exactly one responsible implementation agent per task, named by tool **and** session or task ID. "Claude" or "Codex" alone does not identify an owner. Ownership is per task, not per application.
- **Reviewers:** recorded separately from the owner. A review, or a lead accepting a teammate's output, is not Eric's acceptance of the task.
- **Teammates and subagents:** work inside a task under its owner, who stays accountable for the task.

### 0.2 One record per task

Each implementation task has its own record at `docs/coordination/tasks/<task-id>.md`, made from [`HANDOFF_TEMPLATE.md`](docs/coordination/HANDOFF_TEMPLATE.md). Update it at meaningful milestones, when blocked, before pausing, and before transferring. If this folder has a root `HANDOFF.md`, that file stays the session-level summary. It links to task records rather than repeating their status.

### 0.3 Ownership changes

- Ownership changes only through an explicit handoff written in the task record.
- A session may continue a task without waiting for a human when the record says `status: released` and `escalation_pending: false`.
- Silence, an old timestamp or an ended session never authorizes taking over a task that is `active`, `blocked` or `paused`. Ask the coordinator or Eric.

### 0.4 Before changing files

Check the task's owner, scope, branch, worktree and dependencies, and record them in the task record. Also check whether any other open task touches the same files, migrations, schemas, configuration or runtime resources (§0.9). Flag any overlap before writing.

### 0.5 Concurrent work

- One writing agent per checkout. The exception, approved by Eric, is a lead-managed team inside one task, where the lead gives each teammate a written, disjoint file scope. Teammates in one checkout still share its branch, git index and runtime resources: none of them switches branches, each stages and commits only their own files by path, and the lead coordinates the shared resources in §0.9.
- Concurrent implementation tasks each get their own branch and, where practical, their own worktree.
- Never switch another agent's branch, reset, stash or discard its changes, delete its worktree, or clean up its files without Eric's authorization.
- Worktrees separate files, not runtime. Databases, ports, services and caches can still be shared, so check §0.9 before running anything that could affect another session.

### 0.6 Evidence and completion

- Record the tests you actually ran: the command, the result (`passed`, `failed` or `not run`), and the commit or working state tested.
- These completion stages are separate, and each needs its own evidence: implementation complete, verified, ready for Eric's testing, accepted (Eric only), merged, deployed. A commit, a PR or an agent's claim does not prove any of them.
- Before resuming, compare the record with the actual branch, commits and working tree. Mark anything stale, missing or unknown. Never fill a gap by guessing.

### 0.7 Authority, commits and pushes

- These documents grant no permission. Each of these needs Eric's authorization, either per action or as a standing authorization recorded in §0.9: committing, pushing, opening a PR, merging, deploying, changing access, sending messages, contacting external agents. The coordinator can relay an authorization only by quoting Eric's decision.
- When committing is authorized:
  - Commit on the task's branch, not the default branch.
  - Stage your task's files by path.
  - Keep commits small, and put the task ID in the message.
- Before any commit, check the staged diff for secrets, `.env` files, credentials, personal data and machine-specific paths. The shared `.gitignore` block is a safety net, not a substitute for that check.
- When pushing is authorized, push only the task's branch. Never force-push, rewrite published history, or push one repository's history to another repository's remote.
- Merging to the default branch and deploying are Eric's decisions unless §0.9 records a standing authorization.

### 0.8 Privacy in shared files

Task records and coordination docs are agent-facing. Use relative paths and placeholders. Never include:
- personal email addresses
- credentials
- private machine details such as usernames, volume names or absolute paths
- sensitive business data

Treat every repository as one that may become public.

<!-- coordination-standard:v1:end -->

### 0.9 Project specifics (GRANOLA)

| Item | Value |
|---|---|
| Default branch | `main` |
| Repository | `github.com/ericediger/Muesli` (public). Git repository since 2026-11-16. |
| Delegation | Not recorded. Eric decides per task: solo, subagents or a lead-managed team. |
| Decisions reserved for Eric | Those in §0.1. |
| Quality gates | `npm run typecheck`, `npm test` |
| Shared runtime resources | GUI server on port 4747 (`npm run gui`). `data/` holds synced meeting notes, transcripts, profiles and conversations. That is personal data: it stays ignored, and never goes into task records. |
| Standing authorizations | Eric's default for all application folders (2026-10-29) applies. Commit on the task branch: yes. Push: ask first each time, because the repository is public. Open a pull request: yes. Merge and deploy: Eric only. Before any commit, check that nothing from `data/`, `.env` or real meeting content (names, companies, emails, titles) is staged. |
