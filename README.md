# Muesli

Muesli is granola before the baking: the raw ingredients. This app works the same way with your Granola meetings, reading the raw transcripts rather than the AI summaries.

Muesli is a local web GUI and command-line tool that give you API-level access to your Granola meeting notes for things the Granola app cannot do:

1. **Search, select and export** specific transcripts (with speaker attribution and timestamps) to Markdown, text or JSON, instantly and repeatably.
2. **Ask questions against an explicit set of transcripts** using your own LLM (Claude), with the corpus cached so follow-up questions are cheap, and every conversation saved.
3. **Build a working profile of a person** (emotional intelligence, intellectual style, professional traits) from the transcripts of all your meetings with them (one-on-ones and group meetings), with verbatim evidence and citations back to Granola.

It uses the official [Granola API](https://docs.granola.ai/introduction) and the Anthropic SDK. All data stays on your machine under `data/`.

## Setup

Requirements: Node 22+, a Granola Business/Enterprise workspace, an Anthropic API key, and OpenAI or Gemini keys if you want their models.

```bash
npm install
cp .env.example .env
```

Then fill in `.env`:

- `GRANOLA_API_KEY`: in the Granola desktop app go to **Settings → Connectors → API keys → Create new key**. Tick both *Personal notes* and *Public notes*.
- `ANTHROPIC_API_KEY`: your Anthropic key.
- `OPENAI_API_KEY`: only if you want the GPT models (from platform.openai.com).
- `GEMINI_API_KEY`: only if you want Gemini 4 Carbon or Gemini 4 Hydrogen (from aistudio.google.com; Carbon needs a paid tier).
- Optional model defaults: `LLM_MODEL` (answers and profile synthesis, default `claude-opus-5-5`) with `LLM_EFFORT` (default `high`); `LLM_EXTRACT_MODEL` (per-meeting evidence extraction, default `claude-opus-5-5`) with `LLM_EXTRACT_EFFORT` (default `medium`). Ask and Profiles let you pick a different model and effort per run in the GUI; the CLI has `--model`, `--effort`, `--extract-model`, `--extract-effort`. Also `DATA_DIR`, `ME_EMAIL` / `ME_NAME`.

## Models and providers

The GUI offers seven models in two groups. Prices are per million input / output tokens, and the level in brackets is the effort the model is set to when you pick it:

| Group | Model | Id | Effort | Price |
|---|---|---|---|---|
| Strongest | Claude Fable 5.2 | `claude-fable-5-2` | max | $8 / $40 |
| Strongest | GPT-6 Astra | `gpt-6-astra` | max | $10 / $50 |
| Strongest | Claude Opus 5.5 | `claude-opus-5-5` | max | $4 / $20 |
| Strongest | Gemini 4 Carbon | `gemini-4-carbon` | high | $4 / $20 ($2 / $10 through Nov 30, 2026) |
| Faster and cheaper | Claude Sonnet 5.5 | `claude-sonnet-5-5` | max | $2 / $10 |
| Faster and cheaper | Gemini 4 Hydrogen | `gemini-4-hydrogen` | xhigh | $1.50 / $7.50 |
| Faster and cheaper | GPT-6.1 Terra | `gpt-6.1-terra` | max | $1 / $5 |

Model ids starting with `gemini` are sent to Google with your Gemini key, ids starting with `gpt-` to OpenAI with your OpenAI key, and everything else to Anthropic. Any other model id can still be typed on the CLI or as a custom id in Settings. The GPT models get long-context pricing (roughly double) above 272K input tokens.

Effort maps to each vendor's control: Claude's `effort` and OpenAI's `reasoning.effort` take the five levels directly; Gemini's thinking level runs low, medium, high and, on Hydrogen, xhigh (`max` becomes the model's top level, so Carbon runs at high). Follow-up questions reuse the corpus on every provider: Anthropic caches it explicitly for an hour, OpenAI and Gemini cache repeated prefixes automatically. OpenAI requests are sent with `store: false`, so transcripts are not kept on OpenAI's side for later retrieval. Structured evidence extraction works on all three (Anthropic structured outputs, OpenAI strict JSON schema, Gemini JSON schema).

Check everything:

```bash
npm run granola -- doctor
```

## First run

```bash
npm run granola -- sync
```

The first sync downloads every note the key can see (summary, private notes, transcript, attendees, folders) into `data/notes/*.json` and builds `data/index.json`. Later runs are incremental (only notes updated since the last sync). Granola only exposes notes that already have an AI summary.

Useful variants:

```bash
npm run granola -- sync --since 6m          # only the last six months
npm run granola -- sync --folder fol_xxx    # one folder and its subfolders
npm run granola -- sync --full --refresh    # re-download everything
```

## Web GUI

Double-click **Start Muesli.command** in the project folder. It starts the service in a Terminal window and opens the GUI in your browser; if the service is already running it just opens the browser. Keep that Terminal window open, and close it (or press Ctrl+C) to stop the service.

Or from a terminal:

```bash
npm run gui
```

Then open http://127.0.0.1:4747. The GUI is local only (it binds to localhost) and uses the same `.env` and `data/` as the CLI.

- **Settings**: paste your Granola and Anthropic API keys, set default models and effort for answers/synthesis and for extraction. Keys are written to `.env`, the same file the CLI reads; the page never shows a stored key in full. Edits you make to `.env` by hand take effect in the running GUI without a restart.
- **Overview**: archive stats, sync buttons with live progress, connection checks.
- **Notes**: search the archive with a "Search in" choice (title, summary, people, folders, transcript), read any note with speaker-labelled transcript, tick notes to build a selection.
- **People**: everyone detected from titles, attendees and speaker tags, with shortcuts to their notes, an Ask session, or a profile.
- **Ask**: preview the corpus (note list and token estimate), ask, and keep asking. The model reads transcripts only; answers stream in and are saved under `data/conversations`.
- **Profiles**: choose the meetings (every auto-detected meeting with the person, one-on-one or group, your selected notes, or both), preview, build with live progress, browse and download earlier profiles.
- **Export**: any selection to Markdown, text or JSON, per note or bundled, with download links.

Dark mode is the default; the toggle at the bottom of the sidebar switches to light and remembers your choice.

## Commands

All commands run as `npm run granola -- <command>`; `npm run build` then `./bin/granola.js <command>` also works.

| Command | What it does |
|---|---|
| `doctor` | Verify keys, Granola access, LLM model. |
| `sync` | Download notes + transcripts into the local archive. |
| `folders` | List folders with IDs and local note counts. |
| `search` | Find notes in the archive by text, person, date, folder, or ID. |
| `people` | List people detected from titles, attendees and speaker tags. |
| `note <id>` | Print one note as Markdown (or `--json`). |
| `export` | Write selected notes to files (`md`, `txt`, `json`; `--bundle` for one file). |
| `ask [question]` | Query the LLM over an explicit set of notes; `--chat` for follow-ups. |
| `profile <name>` | Build the EQ / IQ / professional profile of a person from the transcripts of your meetings with them. |
| `webhooks` | List, create, pause, resume or delete Granola webhook endpoints. |

### Selecting notes

`search`, `export` and `ask` share the same selectors and combine them with AND:

```
--ids not_a,not_b          explicit note IDs
-s, --search <text>        words to find (all must match)
--in <fields>              where to look: title,summary,people,folders,transcript (default: title,summary,people,folders)
--deep                     shorthand for adding transcript to --in (slower)
-p, --person <name>        meetings with this person (title convention "YYMMDD - Name", attendees, speaker tags)
--email <email>            attendee email to pair with --person
--since 2026-06-01 | 30d   relative forms: 30d, 8w, 6m, 1y
--until 2026-09-01
-f, --folder <id|name>
-n, --limit <n>
```

### Examples

```bash
# Notes whose title mentions Northwind
npm run granola -- search -s northwind --in title

# Anything about Northwind, including inside transcripts
npm run granola -- search -s northwind --deep

# Export every one-on-one with Dana since June as Markdown with timestamps
npm run granola -- export -p "Dana Whitfield" --since 2026-06-01

# One combined plain-text file of three specific meetings
npm run granola -- export --ids not_a,not_b,not_c --bundle --format txt

# Ask one question over exactly those meetings, then keep asking
npm run granola -- ask --ids not_a,not_b,not_c --chat "What did we commit to, and to whom?"

# Ask across everything from the last 30 days that mentions Tailspin
npm run granola -- ask -s moderna --since 30d "Summarize the open decisions and who owns each."

# See which meetings a profile would use, then build it
npm run granola -- profile "Dana Whitfield" --dry-run
npm run granola -- profile "Dana Whitfield" --since 1y
```

## Choosing content: transcripts or notes

Ask and Profiles use transcripts only: the GUI has no Content choice on those pages, and `ask` and `profile` default to `--content transcript` on the CLI. Export keeps a Content select, defaulting to transcripts plus notes. On the CLI, `--content both` adds Granola's AI summary and your private notes to the transcript; `notes` sends only the summary and private notes, which is far cheaper but cannot quote what was actually said, and the profile prompts say so.

## How `profile` works

1. **Find the person's meetings.** By default the tool auto-detects every meeting with the person, one-on-one or group, from three signals: your title convention (`260908 - Dana Whitfield`), attendee lists when they exist, and speaker tags in transcripts. Run `people` to see what it detects. On the CLI, `--no-group` limits this to one-on-ones. In group meetings Granola labels everyone other than you as "Them", so the extraction step rates how sure it is that a quote is the person's. To choose the meetings yourself, tick them on the Notes page (GUI) or pass `--ids not_a,not_b` (CLI); add `--plus-auto` to combine your picks with the auto-detected meetings.
2. **Extract evidence per meeting.** Each transcript is sent separately with a strict schema: observations tagged EQ / IQ / Professional, each with a verbatim quote spoken by the person and an attribution-certainty rating, plus commitments made and the dynamics with you. Results are cached under `data/profiles/<person>/evidence/` and reused until the note changes.
3. **Synthesize.** The evidence, and by default the raw transcripts as well, go to the model in one streamed call that writes the profile: snapshot, EQ, IQ, professional, trajectory, how to work with them, open questions, evidence log. Output lands in `data/profiles/<person>/<person>_<date>.md` alongside `profile.json` (evidence, meeting list, token usage).

The profile is framed as a working-relationship aid inferred from conversations with you. It is not a performance review and the prompts avoid clinical language. Treat it as private.

## Data layout

```
data/
  index.json            searchable index (titles, attendees, speakers, word counts, me-vs-them share)
  notes/<not_id>.json   full note: summary, private notes, attendees, folders, transcript items
  exports/<stamp>/      export runs, each with manifest.json
  conversations/        saved ask sessions
  profiles/<person>/    profile Markdown, profile.json, evidence/ cache
```

`data/` and `.env` are git-ignored.

## Costs and limits

- Granola allows 5 requests/second (burst 25). The client rate-limits and retries automatically; a full first sync of ~1,000 notes takes a few minutes.
- `ask` puts the whole selected corpus in context. It prints the estimated token count first, asks before sending more than 300k tokens, and refuses above 900k. Follow-ups in `--chat` reuse the cached corpus (1-hour cache).
- `profile` costs roughly one extraction call per meeting plus one synthesis call. Extraction defaults to Opus 5.5 at medium effort; GPT-6.1 Terra and Gemini 4 Hydrogen are the cheapest choices for that step, and `--no-corpus` reduces the synthesis cost further. Claude Fable 5.2 and GPT-6 Astra are the strongest options for the final synthesis but slower and two to three times the price of Opus 5.5. Gemini 4 Carbon costs the same as Opus 5.5 from December 1, 2026, and half that until then. Effort `max` raises cost and time on every model; it pays off mainly on the final synthesis.
- The model is prompted to say when the answer is not in the corpus and to flag uncertain speaker attribution; verify quotes against the linked Granola note when it matters.

## Development

```bash
npm run typecheck
npm test
```

See [USE-CASES.md](USE-CASES.md) for what the API makes possible beyond the Granola app.
