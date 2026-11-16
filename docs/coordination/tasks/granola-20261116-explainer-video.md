---
record: task-handoff
standard: coordination-v1
task_id: granola-20261116-explainer-video
title: Make a narrated explainer video of the Muesli web GUI with /sizzle
folder: GRANOLA
status: active
owner:
  tool: Claude Code
  session_id: d7de786c-d1df-48ea-91bb-7c7849d5a6b8
  since: 2026-11-16T15:17-05:00
reviewers: []
coordinator: Pasta
project_owner: Eric
released_to: none
escalation_pending: false
closed_reason: none
branch: granola-20261116-explainer-video
base_branch: main
worktree: main checkout
latest_commit: see the branch (this record is part of the commit)
uncommitted_changes: none from this task after the commit
depends_on: [the sizzle engine, kept outside this repository]
blocks: []
milestones:
  implementation_complete: yes
  verified: yes             # stills and check frames reviewed, gates passed; see Verification
  ready_for_owner_testing: yes
  accepted: no
  merged: no
  deployed: no
updated_at: 2026-11-16T16:05-05:00
updated_by: Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8
---

# granola-20261116-explainer-video: Make a narrated explainer video of the Muesli web GUI with /sizzle

## Goal

A one-to-two-minute explainer video of the Muesli web GUI, made with the /sizzle skill, as Eric asked ("I want to create an explainer video using /sizzle", 2026-11-16).

## Acceptance criteria

- Eric signs off the storyboard (scene list and narration) before recording.
- The video shows only fictional meeting data: no real names, companies, emails, titles or transcripts from `data/`.
- Eric accepts the finished video.

## Scope

- **In scope:** `explainer/` (video source), `media/` (the rendered video and poster), this record. Possibly a README snippet linking the poster, if Eric wants it.
- **Out of scope:** the app's own code in `src/` and `web/`. The video films the existing GUI against a stage with fictional data.
- **Shared resources touched:** none. The stage was served on its own local port during checks, never the GUI service on port 4747, and it never reads `data/` or `.env`.

## Current state

The video is rendered: `media/muesli-explainer.mp4` (68.4 s, 1920×1080, about 17.5 MB) and `media/explainer-poster.jpg`. Seven scenes: an animated opener, five footage scenes (Overview with sync, Notes search and selection, a transcript, Ask with a streamed answer, Profiles), and an animated outro. Narration is the ElevenLabs voice set in the engine; the music bed is "Sunset in Ibiza" from the author's own ElevenLabs Music workspace. Waiting for Eric's acceptance and his decision on pushing.

## Completed

- `explainer/script.ts` (storyboard), `explainer/record.ts` (footage choreography), `explainer/scenes/` (ColdOpen, Outro, Logo), `explainer/index.ts`.
- `explainer/demo/build-stage.mjs` copies `web/` into a gitignored `explainer/demo/stage/` and loads `explainer/demo/mock-api.js` first, which answers every `/api/` call from fictional data in memory.
- `explainer/public/music/Sunset_in_Ibiza.mp3` (3.6 MB), the music bed Eric chose.

## Remaining

- Eric reviews and accepts the video.
- Push and pull request, if Eric approves the push (public repository).
- Optional README snippet linking the poster to the video.

## Blockers

- none

## Decisions needed (from Eric)

- Push the branch and open a pull request. The commit adds about 21 MB (video 17.5 MB, music 3.6 MB, poster 0.1 MB) to a public repository.
- Storyboard: Eric did not answer the sign-off question directly; he picked the music, then approved the full render after seeing the stills.

## Next step

Eric watches `media/muesli-explainer.mp4` and decides whether to push.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| explainer type-check | `npm --prefix <engine> run check` | passed | working tree at 580d8e6 + this task's files | 2026-11-16T15:58-05:00 |
| app typecheck | `npm run typecheck` | passed | same | 2026-11-16T16:03-05:00 |
| app tests | `npm test` | passed (19/19) | same | 2026-11-16T16:03-05:00 |
| footage timing | `npm --prefix <engine> run record` | passed after one fix (no late beats) | same | 2026-11-16T15:45-05:00 |
| stills | `npm --prefix <engine> run stills` and `-- --late`, plus frames at the ends of the sync, Ask and Profiles scenes | reviewed: framing, zooms, spotlight and text legible | same | 2026-11-16T15:52-05:00 |
| render | `npm --prefix <engine> run render`, `run poster` | passed: 68.4 s, -16.0 LUFS, true peak -2.2 dBTP, one linear gain | same | 2026-11-16T16:00-05:00 |
| stage flows | built-in browser against the stage: sync, search, transcript drawer, Ask, Profiles | passed | same | 2026-11-16T15:40-05:00 |
| privacy scan | grep of the new files for absolute paths, emails, keys and voice ids | passed (no hits besides role names) | same | 2026-11-16T16:04-05:00 |

**Verification limits:** the video was checked from stills and single frames, not watched end to end with sound. The narration audio and music balance were checked only by the loudness measurement.

## Evidence

- `media/muesli-explainer.mp4`, `media/explainer-poster.jpg`
- The engine's build cache (outside this repository) holds the narration clips, footage, stills and contact sheet.

## Discrepancies found on resume

- none

## Notes for other tasks

- `web/style.css`: `.card + .card { margin-top: 14px; }` also applies inside `.grid`, so every card after the first in a grid row sits 14 px lower (visible on Overview). Not fixed here; out of scope.
- `web/app.js`: during a streamed Ask answer or profile build, a pending animation-frame render can run after the `done` event and put the typing cursor back, hiding the usage line, when frames are throttled. Not fixed here; out of scope.

## Log

- 2026-11-16T15:17-05:00 · Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8 · created · task opened at Eric's request; branch cut from main. The uncommitted closing update to the MIT license record belongs to that task and is left untouched.
- 2026-11-16T16:05-05:00 · Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8 · updated · video rendered and verified; Eric approved the render after the stills; committed on the task branch under the standing authorization. Push not done: needs Eric's approval.
