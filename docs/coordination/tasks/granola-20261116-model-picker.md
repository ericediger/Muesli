---
record: task-handoff
standard: coordination-v1
task_id: granola-20261116-model-picker
title: Replace the model picker with seven models across Anthropic, OpenAI and Gemini
folder: GRANOLA
status: active
owner:
  tool: Claude Code
  session_id: 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d
  since: 2026-11-16T11:48-05:00
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
uncommitted_changes: not a git repository; 14 files changed or added (see Completed)
depends_on: []
blocks: []
milestones:
  implementation_complete: yes
  verified: no              # Gemini calls (Hydrogen xhigh, Carbon high) not confirmed (Google billing), see Verification
  ready_for_owner_testing: yes
  accepted: no
  merged: no
  deployed: yes             # running in the local GUI service on port 4747 after a restart
updated_at: 2026-11-16T13:33-05:00
updated_by: Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d
---

# granola-20261116-model-picker: Replace the model picker with seven models across Anthropic, OpenAI and Gemini

## Goal

Offer exactly the models Eric listed in the GUI pickers, each with the effort level he gave, and make every one of them runnable for answers, profile synthesis and extraction.

## Acceptance criteria

- Eric's list (2026-11-16), in this order: Fable 5.2 (MAX), GPT-6 Astra (MAX), Opus 5.5 (MAX); then Sonnet 5.5 (MAX), Gemini Hydrogen (XHIGH), GPT-6.1 Terra (MAX).
- Eric's follow-up (2026-11-16): add Gemini 4 Carbon. He gave no effort or position. Interpretation: Google's model card calls Carbon its strongest reasoning model and it is priced like Opus 5.5, so it sits last in the "Strongest" group, at high, which is its top thinking level (it has no xhigh).
- Choosing a model in a picker sets the matching effort picker to that model's listed level.
- GPT models work, which needs an OpenAI provider (none exists yet). Eric added the provider keys to `.env`.
- Interpretation, not stated by Eric: the blank line splits the list into two groups. The top three are the costlier, stronger models and the bottom three the cheaper ones, so the picker shows them as two labelled groups. Saved defaults in `.env` are left as they are.

## Scope

- **In scope:** `src/config.ts` (model list, OpenAI key), `src/llm/` (new `openai.ts`, routing in `index.ts`, `types.ts`, Gemini xhigh in `gemini.ts`), `src/server.ts` (settings key), `src/services/doctor.ts` if needed, `web/app.js` (pickers, effort hints, OpenAI key field), `package.json` (add the `openai` SDK), `.env.example`, `README.md`, tests under `test/`.
- **Out of scope:** changing Eric's saved model or effort settings; the transcript importer; Granola sync.
- **Shared resources touched:** GUI server on port 4747 (runs as a login agent and must be restarted to pick up the change); `.env` is read, not changed.

## Current state

The seven models are in the pickers in two groups, and choosing one sets its effort. GPT models run through a new OpenAI provider (Responses API, `store: false`, encrypted reasoning replayed on follow-ups, strict JSON schema for extraction). Gemini maps `xhigh` and `max` to the XHIGH thinking level on Hydrogen only; on Carbon they become high. The GUI service was restarted and serves the new list. Eric's saved defaults are unchanged (answers: Opus 5.5 at xhigh; extraction: Opus 5.5 at high).

## Completed

- Model list with effort and group per model: `src/config.ts` (also `OPENAI_API_KEY`, `requireOpenAIKey`).
- OpenAI provider: `src/llm/openai.ts` (new); routing for `gpt-` / o-series ids: `src/llm/index.ts`; `src/llm/types.ts`.
- Gemini Hydrogen xhigh: `src/llm/gemini.ts` (`supportsXHigh`, `toThinkingLevel(effort, model)`).
- Settings key, status and doctor: `src/server.ts`, `src/services/doctor.ts`, `src/commands/doctor.ts`.
- GUI: grouped pickers, model-to-effort binding on Settings, Ask and Profiles, OpenAI key field and connection row: `web/app.js`.
- Dependency `openai` 7.57.0 pinned: `package.json`, `package-lock.json`.
- Docs and tests: `.env.example`, `README.md`, `test/llm.test.ts`.
- Gemini 4 Carbon added (same files: `src/config.ts`, `src/llm/gemini.ts` comment, `test/llm.test.ts`, `README.md`, `.env.example`).

## Remaining

- Confirm a Gemini 4 Hydrogen call at xhigh and a Gemini 4 Carbon call at high once the Google AI Studio project has credits.
- Carbon's model metadata lists a 32,768-token output limit, while Google's thinking docs give 65,536 for streamed calls. The app streams answers and synthesis with a 64,000 cap and extracts (non-streamed) with 16,000. Confirm the 64,000 cap is accepted on Carbon when the live check runs.

## Blockers

- Gemini live calls fail on Google billing: 402 "prepayment credits are depleted" (Hydrogen, 11:53) and 429 "exceeded your current quota, check your plan and billing" (Carbon, 13:30). Eric can top up credits in AI Studio. Carbon has no free tier.

## Decisions needed (from Eric)

- Whether to switch his saved defaults to the listed effort levels (currently not changed). Recommendation: keep extraction below max, since it is one call per meeting.
- Found in passing, out of scope: on Settings the "Custom model id" fields always show, because `.form-grid { display: grid }` overrides the `hidden` attribute. One CSS rule fixes it.

## Next step

After Google credits are added, run one Gemini 4 Hydrogen completion at xhigh and one Gemini 4 Carbon completion at high with `maxTokens: 64000` (the scratch checks used `providerFor(id).complete(...)`) and record the results.

## Verification

| Check | Command | Result | State tested | When |
|---|---|---|---|---|
| typecheck | `npm run typecheck` | passed | working tree | 2026-11-16T11:53-05:00 |
| tests | `npm test` | passed (18/18) | working tree | 2026-11-16T11:53-05:00 |
| model lookup, all six | provider `checkModel` per id (scratch script) | passed | working tree | 2026-11-16T11:53-05:00 |
| Claude Sonnet 5.5 at max | one-word completion | passed | working tree | 2026-11-16T11:53-05:00 |
| GPT-6.1 Terra at max | one-word completion | passed | working tree | 2026-11-16T11:53-05:00 |
| GPT-6.1 Terra extraction | strict JSON schema via `extractStructured` | passed | working tree | 2026-11-16T11:53-05:00 |
| GPT-6.1 Terra chat | two turns, reasoning replayed | passed | working tree | 2026-11-16T11:53-05:00 |
| Gemini 4 Hydrogen at xhigh | one-word completion | failed (402, Google credits used up) | working tree | 2026-11-16T11:53-05:00 |
| GUI pickers | browser: groups, model sets effort, OpenAI field, no console errors | passed | GUI service after restart | 2026-11-16T11:54-05:00 |
| typecheck (Carbon added) | `npm run typecheck` | passed | working tree | 2026-11-16T13:30-05:00 |
| tests (Carbon added) | `npm test` | passed (18/18) | working tree | 2026-11-16T13:30-05:00 |
| Gemini 4 Carbon lookup | provider `checkModel` (scratch script) | passed | working tree | 2026-11-16T13:30-05:00 |
| Gemini 4 Carbon at high | one-word streamed completion, `maxTokens: 64000` | failed (429, Google quota and billing) | working tree | 2026-11-16T13:30-05:00 |
| GUI pickers (Carbon added) | browser: Carbon last in Strongest, choosing it sets high, Hydrogen still sets xhigh, no console errors | passed | GUI service after restart | 2026-11-16T13:32-05:00 |

**Verification limits:** Fable 5.2, GPT-6 Astra and Opus 5.5 were looked up but not called (cost). A full Ask or Profile run on the new models was not done. No Gemini 4 generation call has succeeded yet, so Hydrogen xhigh and Carbon's 64,000 output cap are unconfirmed against the API.

## Evidence

- Model IDs, prices and effort levels: OpenAI model pages for gpt-6-astra and gpt-6.1-terra, OpenAI pricing page, Google AI Studio thinking docs, Anthropic API reference (cached 2026-11-03).
- Gemini 4 Carbon: Google AI Studio models page (id, "strongest reasoning model"), pricing page ($2 / $10 through 2026-11-30, $4 / $20 from 2026-12-01, implicit caching only, no free tier), thinking page (low, medium, high; default medium); Gemini API model list (id present, output limit 32,768).

## Discrepancies found on resume

- none

## Log

- 2026-11-16T11:48-05:00 · Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d · created · task opened from Eric's request in chat; preflight: not a git repo, no other task records, no overlap
- 2026-11-16T11:54-05:00 · Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d · updated · implementation complete; gates passed; GUI service restarted; Gemini live check blocked on Google billing
- 2026-11-16T13:33-05:00 · Claude Code 1e01a2f2-d5f7-4864-8ab7-10ac8ad9d96d · updated · added Gemini 4 Carbon at Eric's request (Strongest, high); gates passed; GUI service restarted; Carbon live call blocked on the same Google billing issue
