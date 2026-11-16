---
record: task-handoff
standard: coordination-v1
task_id: granola-20261116-explainer-video
title: Make a narrated explainer video of the Muesli web GUI with /sizzle
folder: GRANOLA
status: closed
owner:
  tool: Claude Code
  session_id: d7de786c-d1df-48ea-91bb-7c7849d5a6b8
  since: 2026-11-16T15:17-05:00
reviewers: []
coordinator: Pasta
project_owner: Eric
released_to: none
escalation_pending: false
closed_reason: accepted (Eric asked to merge pull request #2 and turn on GitHub Pages, 2026-11-16)
branch: granola-20261116-explainer-video
base_branch: main
worktree: main checkout
latest_commit: 47fa3a3, merged into main as 578f3be
uncommitted_changes: this record's closing update (not committed; see Log)
depends_on: [the sizzle engine, kept outside this repository]
blocks: []
milestones:
  implementation_complete: yes
  verified: yes             # stills and check frames reviewed, gates passed; see Verification
  ready_for_owner_testing: yes
  accepted: yes             # Eric asked for the merge and the Pages site
  merged: yes               # 578f3be on main, 2026-11-16
  deployed: yes             # GitHub Pages (main, /) built; video URL returns 200
updated_at: 2026-11-16T16:27-05:00
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

- **In scope:** `explainer/` (video source), `media/` (the rendered video and poster), the top of `README.md` (poster and link to the video), this record.
- **Out of scope:** the app's own code in `src/` and `web/`. The video films the existing GUI against a stage with fictional data.
- **Shared resources touched:** none. The stage was served on its own local port during checks, never the GUI service on port 4747, and it never reads `data/` or `.env`.

## Current state

Merged into `main` as 578f3be, and GitHub Pages is on for the repository (source `main`, `/`). The README opens with the poster, which links to https://ericediger.github.io/Muesli/media/muesli-explainer.mp4 (checked: HTTP 200, video/mp4, 17,540,226 bytes). The task branch is still on GitHub and local; it was not deleted.

## Completed

- `explainer/script.ts` (storyboard), `explainer/record.ts` (footage choreography), `explainer/scenes/` (ColdOpen, Outro, Logo), `explainer/index.ts`.
- `explainer/demo/build-stage.mjs` copies `web/` into a gitignored `explainer/demo/stage/` and loads `explainer/demo/mock-api.js` first, which answers every `/api/` call from fictional data in memory.
- `explainer/public/music/Sunset_in_Ibiza.mp3` (3.6 MB), the music bed Eric chose.

## Remaining

- none

## Blockers

- none

## Decisions needed (from Eric)

- Merge and GitHub Pages: done (Eric said \"Merge and enable Pages\").
- Optional: delete the task branch, on GitHub and locally.

## Next step

None.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| explainer type-check | `npm --prefix <engine> run check` | passed | working tree at 580d8e6 + this task's files | 2026-11-16T15:58-05:00 |
| app typecheck | `npm run typecheck` | passed | same | 2026-11-16, just before commit b808590 (16:01) |
| app tests | `npm test` | passed (19/19) | same | 2026-11-16, just before commit b808590 (16:01) |
| footage timing | `npm --prefix <engine> run record` | passed after one fix (no late beats) | same | 2026-11-16T15:45-05:00 |
| stills | `npm --prefix <engine> run stills` and `-- --late`, plus frames at the ends of the sync, Ask and Profiles scenes | reviewed: framing, zooms, spotlight and text legible | same | 2026-11-16T15:52-05:00 |
| render | `npm --prefix <engine> run render`, `run poster` | passed: 68.4 s, -16.0 LUFS, true peak -2.2 dBTP, one linear gain | same | 2026-11-16T16:00-05:00 (file times in `media/`) |
| stage flows | built-in browser against the stage: sync, search, transcript drawer, Ask, Profiles | passed | same | 2026-11-16T15:40-05:00 |
| Pages video link | `curl -I https://ericediger.github.io/Muesli/media/muesli-explainer.mp4` | passed: 200, video/mp4, 17,540,226 bytes | main at 578f3be | 2026-11-16T16:27-05:00 |
| privacy scan | grep of the new files for absolute paths, emails, keys and voice ids | passed (no hits besides role names) | same | 2026-11-16, just before commit b808590 (16:01) |

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
- 2026-11-16T16:12-05:00 · Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8 · updated · added the poster and video link to the top of README.md, matching flight-deck, STRATEGOS and pawn (GitHub Pages URL); pushing the branch and opening a pull request at Eric's request.
- 2026-11-16T16:10-05:00 · Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8 · corrected · several times in this record were estimated and ran ahead of the clock. The two log lines above marked 16:05 and 16:12 match commits b808590 (16:01) and 53082a7 (16:04); front-matter and verification times are now taken from commit and file times. Branch pushed and pull request #2 opened at 16:05.
- 2026-11-16T16:27-05:00 · Claude Code d7de786c-d1df-48ea-91bb-7c7849d5a6b8 · closed · Eric said "Merge and enable Pages"; merged pull request #2 into main as 578f3be (16:26); turned on GitHub Pages (legacy build, main, /); build finished and the README's video link plays. This closing update is left uncommitted, because committing to main directly is against §0.7; it goes in with the next change, like the MIT license record's.
