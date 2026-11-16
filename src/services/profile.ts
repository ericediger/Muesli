import fs from "node:fs";
import path from "node:path";
import type { TextBlock } from "../llm/index.js";
import { config, type Effort } from "../config.js";
import { buildCorpus, contentFlags, normalizeContentMode, type ContentMode } from "../corpus/format.js";
import { classifyMeeting, personMatchesEntry, type MeetingKind } from "../people/people.js";
import { loadIndex, loadNote, paths, type Index, type IndexEntry, type StoredNote } from "../store/store.js";
import { addUsage, emptyUsage, providerFor, type UsageSummary } from "../llm/index.js";
import { MeetingEvidenceSchema, extractSystemPrompt, synthesisSystemPrompt, type MeetingEvidence } from "../prompts/profile.js";
import { isoDate, pLimit, parseSince, slugify } from "../util.js";

export interface ProfileOptions {
  name: string;
  email?: string;
  since?: string;
  until?: string;
  /** Explicit note IDs to use instead of (or, with plusAuto, in addition to) auto-detected meetings. */
  ids?: string[];
  /** With ids: also add auto-detected meetings with the person. */
  plusAuto?: boolean;
  /** Which note content feeds the model: transcripts only (default), transcripts + notes, or notes only. */
  content?: ContentMode;
  /** Auto-detection keeps group meetings unless this is false (then one-on-ones only). */
  includeGroup?: boolean;
  /** Include raw transcripts in the synthesis call (default true). */
  corpus?: boolean;
  concurrency?: number;
  model?: string;
  extractModel?: string;
  /** Effort for the synthesis call (default LLM_EFFORT). */
  effort?: Effort;
  /** Effort for the per-meeting extraction calls (default LLM_EXTRACT_EFFORT). */
  extractEffort?: Effort;
  out?: string;
  refresh?: boolean;
}

export interface SelectedMeeting {
  entry: IndexEntry;
  kind: MeetingKind;
}

export type ProfileSource = "auto" | "ids" | "ids+auto";

export interface ProfileSelection {
  index: Index;
  source: ProfileSource;
  content: ContentMode;
  /** Meetings that mention the person (auto-detection), before the one-on-one filter. */
  candidates: number;
  selected: SelectedMeeting[];
  /** Auto-detected meetings dropped as group/unclear. */
  skipped: number;
  /** Explicitly chosen notes that were used. */
  explicit: number;
  /** Explicitly chosen IDs not found in the archive or lacking the required content. */
  missing: string[];
}

export interface ProfileHooks {
  log?: (msg: string) => void;
  onText?: (delta: string) => void;
}

export interface ProfileResult {
  outFile: string;
  jsonFile: string;
  usage: UsageSummary;
  model: string;
  meetings: SelectedMeeting[];
  text: string;
}

export function selectProfileMeetings(o: ProfileOptions): ProfileSelection {
  const index = loadIndex();
  if (!index.notes.length) throw new Error("The local archive is empty. Run a sync first.");
  const q = { name: o.name, email: o.email };
  const content = normalizeContentMode(o.content, "transcript");
  const needTranscript = content !== "notes";
  const ids = (o.ids ?? []).map((s) => s.trim()).filter(Boolean);
  const source: ProfileSource = ids.length ? (o.plusAuto ? "ids+auto" : "ids") : "auto";

  // Explicitly chosen notes (the selection basket / --ids).
  const byId = new Map(index.notes.map((n) => [n.id, n]));
  const explicit: SelectedMeeting[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const e = byId.get(id);
    if (!e || (needTranscript && !e.has_transcript)) {
      missing.push(id);
      continue;
    }
    explicit.push({ entry: e, kind: classifyMeeting(e, q, index.me) });
  }

  // Auto-detected meetings with the person.
  let candidates = 0;
  let auto: SelectedMeeting[] = [];
  if (source !== "ids") {
    const since = parseSince(o.since);
    const until = o.until ? parseSince(o.until) : undefined;
    const found: SelectedMeeting[] = [];
    for (const e of index.notes) {
      if (since && e.created_at < since) continue;
      if (until && e.created_at > until) continue;
      if (needTranscript && !e.has_transcript) continue;
      if (!personMatchesEntry(e, q, index.me).match) continue;
      found.push({ entry: e, kind: classifyMeeting(e, q, index.me) });
    }
    candidates = found.length;
    auto = o.includeGroup === false ? found.filter((c) => c.kind === "one_on_one") : found;
  }

  const seen = new Set<string>();
  const selected = [...explicit, ...auto]
    .filter((m) => (seen.has(m.entry.id) ? false : (seen.add(m.entry.id), true)))
    .sort((a, b) => a.entry.created_at.localeCompare(b.entry.created_at));
  return { index, source, content, candidates, selected, skipped: candidates - auto.length, explicit: explicit.length, missing };
}

export async function buildProfile(o: ProfileOptions, hooks: ProfileHooks = {}): Promise<ProfileResult> {
  const log = hooks.log ?? (() => {});
  const sel = selectProfileMeetings(o);
  const { index, selected, candidates, skipped, source, content, explicit, missing } = sel;
  const me = index.me;
  const meName = me.name ?? "Me";
  const name = o.name;
  const flags = contentFlags(content);
  log(describeProfileSelection(name, sel));
  if (missing.length) log(`Ignored ${missing.length} selected note(s) not in the archive${content !== "notes" ? " or without a transcript" : ""}: ${missing.join(", ")}`);
  if (!selected.length) {
    throw new Error(
      source === "ids"
        ? `None of the selected notes can be used for "${name}".`
        : `No usable meetings with "${name}". Check the People page for detected names, or select notes yourself.`,
    );
  }
  void candidates;
  void skipped;
  void explicit;

  const slug = slugify(name);
  const dir = path.join(paths.profiles(), slug);
  const evidenceDir = path.join(dir, "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const effort = o.effort ?? config.llmEffort;
  const extractEffort = o.extractEffort ?? config.llmExtractEffort;
  const extractModel = o.extractModel ?? config.llmExtractModel;
  log(`Models: extraction ${extractModel} (effort ${extractEffort}); synthesis ${o.model ?? config.llmModel} (effort ${effort}).`);
  const total: UsageSummary = emptyUsage();
  const synthModel = o.model ?? config.llmModel;

  // ---- Map: per-meeting evidence extraction --------------------------------
  const notes = new Map<string, StoredNote>();
  const run = pLimit(Math.max(1, o.concurrency ?? 3));
  let done = 0;
  const evidence: MeetingEvidence[] = [];
  await Promise.all(
    selected.map(({ entry, kind }) =>
      run(async () => {
        const note = loadNote(entry.id);
        notes.set(entry.id, note);
        const cacheFile = path.join(evidenceDir, `${entry.id}${content === "both" ? "" : `.${content}`}.json`);
        if (!o.refresh && fs.existsSync(cacheFile)) {
          const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as { note_updated_at: string; evidence: MeetingEvidence };
          if (cached.note_updated_at === note.updated_at) {
            evidence.push(cached.evidence);
            done += 1;
            log(`[${done}/${selected.length}] cached: ${entry.title ?? entry.id}`);
            return;
          }
        }
        const single = buildCorpus([note], { meName, themName: kind === "one_on_one" ? name : undefined, ...flags });
        const { data, usage } = await providerFor(extractModel).extractStructured({
          schema: MeetingEvidenceSchema,
          system: extractSystemPrompt(name, meName, content),
          user: `${single.text}\n\nExtract the evidence for ${name} from the meeting above.`,
          model: extractModel,
          effort: extractEffort,
        });
        data.meeting_id = entry.id;
        addUsage(total, usage);
        evidence.push(data);
        fs.writeFileSync(
          cacheFile,
          JSON.stringify({ note_updated_at: note.updated_at, extracted_at: new Date().toISOString(), evidence: data }, null, 2),
        );
        done += 1;
        log(`[${done}/${selected.length}] extracted: ${entry.title ?? entry.id} (${data.observations.length} observations)`);
      }),
    ),
  );
  evidence.sort((a, b) => (notes.get(a.meeting_id)?.created_at ?? "").localeCompare(notes.get(b.meeting_id)?.created_at ?? ""));

  // ---- Reduce: synthesis -----------------------------------------------------
  const orderedNotes = selected.map((s) => notes.get(s.entry.id)!);
  const meetingList = selected
    .map((s) => `- ${isoDate(s.entry.created_at)} ${s.entry.title ?? "(untitled)"} [${s.entry.id}] ${s.entry.web_url}`)
    .join("\n");
  const from = isoDate(selected[0].entry.created_at);
  const to = isoDate(selected[selected.length - 1].entry.created_at);
  const evidenceText = evidence
    .map((ev) => {
      const n = notes.get(ev.meeting_id);
      return `### ${n ? isoDate(n.created_at) : ""} ${n?.title ?? ev.meeting_id} [${ev.meeting_id}]\n${JSON.stringify(ev, null, 1)}`;
    })
    .join("\n\n");

  const blocks: TextBlock[] = [];
  if (o.corpus ?? true) {
    const corpus = buildCorpus(orderedNotes, { meName, themName: name, ...flags });
    log(`Synthesis corpus: ${corpus.noteCount} meetings, ~${corpus.tokens.toLocaleString()} tokens plus evidence.`);
    if (corpus.tokens > 850_000) throw new Error("Corpus too large for one synthesis call; narrow the date range or disable raw transcripts.");
    blocks.push({ text: `<corpus>\n${corpus.text}\n</corpus>`, cache: true });
  }
  blocks.push({
    text: `Person: ${name}${o.email ? ` <${o.email}>` : ""}\nNote owner: ${meName}${me.email ? ` <${me.email}>` : ""}\nPeriod: ${from} to ${to}\n\nMeetings used:\n${meetingList}\n\n<evidence>\n${evidenceText}\n</evidence>\n\nWrite the profile now.`,
  });

  const outFile = path.resolve(o.out ?? path.join(dir, `${slug}_${to}.md`));
  log(`Synthesizing profile with ${synthModel}…`);
  const res = await providerFor(synthModel).complete({
    system: synthesisSystemPrompt(name, meName, content),
    blocks,
    model: synthModel,
    effort,
    maxTokens: 64000,
    onText: hooks.onText,
  });
  addUsage(total, res.usage);

  const footer = `\n\n---\n_Generated ${new Date().toISOString()} by Muesli from ${selected.length} meeting(s) (${from} to ${to}), content: ${content}; model ${res.model}, effort ${effort}. Inferences from records of conversations with ${meName} only._\n`;
  fs.writeFileSync(outFile, res.text + footer);
  const jsonFile = path.join(dir, "profile.json");
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        person: name,
        email: o.email ?? null,
        generated_at: new Date().toISOString(),
        model: res.model,
        extract_model: extractModel,
        effort,
        extract_effort: extractEffort,
        source,
        content,
        meetings: selected.map((s) => ({ id: s.entry.id, title: s.entry.title, created_at: s.entry.created_at, kind: s.kind, web_url: s.entry.web_url })),
        evidence,
        usage: total,
        profile_file: outFile,
      },
      null,
      2,
    ),
  );
  log(`Profile written to ${outFile}`);
  return { outFile, jsonFile, usage: total, model: res.model, meetings: selected, text: res.text };
}

/** One-line description of how meetings were chosen, for logs and dry runs. */
export function describeProfileSelection(name: string, s: ProfileSelection): string {
  const parts: string[] = [];
  if (s.source !== "auto") parts.push(`${s.explicit} selected note(s)`);
  if (s.source !== "ids") parts.push(`${s.candidates} auto-detected meeting(s) with ${name}${s.skipped ? `, ${s.skipped} group/unclear skipped` : ""}`);
  return `Using ${s.selected.length} meeting(s) [${parts.join(" + ")}], content: ${s.content}.`;
}

export interface ProfileListing {
  person: string;
  slug: string;
  file: string;
  generated_at: string | null;
  meetings: number;
  model: string | null;
}

/** Existing profiles on disk, newest first. */
export function listProfiles(): ProfileListing[] {
  const root = paths.profiles();
  if (!fs.existsSync(root)) return [];
  const out: ProfileListing[] = [];
  for (const slug of fs.readdirSync(root)) {
    const dir = path.join(root, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    let meta: { person?: string; generated_at?: string; meetings?: unknown[]; model?: string; profile_file?: string } = {};
    const metaFile = path.join(dir, "profile.json");
    if (fs.existsSync(metaFile)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
      } catch {
        meta = {};
      }
    }
    const mdFiles = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    for (const f of mdFiles) {
      out.push({
        person: meta.person ?? slug,
        slug,
        file: path.join(dir, f),
        generated_at: meta.profile_file && path.basename(meta.profile_file) === f ? (meta.generated_at ?? null) : null,
        meetings: meta.meetings?.length ?? 0,
        model: meta.model ?? null,
      });
    }
  }
  return out.sort((a, b) => b.file.localeCompare(a.file));
}
