# CLAUDE.md — GRANOLA

@AGENTS.md

> **Shared rules:** The line above imports `AGENTS.md`, which Codex and other agents also read. Its §0 Coordination Standard applies to every Claude Code session here. Coordination procedures are in `docs/coordination/README.md`. Add Claude-specific guidance below this note.

### Claude Code coordination notes

- **Your owner ID:** "Claude Code" plus the session ID that Claude Code shows for this session (desktop app or CLI). If you cannot find it, record `unknown` together with the session title and start time.
- **Continuing work:** a session may pick up a task only when its record is `released` and no escalation is pending (`docs/coordination/README.md`, *Resume or claim*).
- **Worktrees:** the desktop app may create worktrees under `.claude/worktrees/<name>` and remove them when the session is cleaned up. Anything that exists only in a worktree, the task record included, is lost with it. Before cleanup, commit the work and the record to the task branch, and confirm from the main checkout that the branch has them. If you can't commit, keep the worktree, say so in the record and tell the coordinator.
- **Teammates and subagents:** spawning them does not change the task owner. Give each teammate a written, disjoint file scope.
