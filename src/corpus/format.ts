import type { Note, TranscriptItem } from "../granola/types.js";
import { isoDate } from "../util.js";
import { parseTitleSubject } from "../people/people.js";

/** Which parts of a note feed the model or an export. */
export type ContentMode = "both" | "transcript" | "notes";
export const CONTENT_MODES: ContentMode[] = ["both", "transcript", "notes"];
export const CONTENT_MODE_LABELS: Record<ContentMode, string> = {
  both: "transcripts + notes",
  transcript: "transcripts only",
  notes: "notes only (AI summary + private notes)",
};

export function normalizeContentMode(v: unknown, fallback: ContentMode = "both"): ContentMode {
  return typeof v === "string" && (CONTENT_MODES as string[]).includes(v) ? (v as ContentMode) : fallback;
}

/** Translate a content mode into section flags. */
export function contentFlags(mode: ContentMode, privateNotes = true): Pick<FormatOptions, "includeSummary" | "includePrivateNotes" | "includeTranscript"> {
  return {
    includeSummary: mode !== "transcript",
    includePrivateNotes: mode !== "transcript" && privateNotes,
    includeTranscript: mode !== "notes",
  };
}

export interface FormatOptions {
  meName: string;
  /** Label for `them` lines when the meeting is a one-on-one with a known person. */
  themName?: string;
  timestamps?: boolean;
  mergeTurns?: boolean;
  includeSummary?: boolean;
  includePrivateNotes?: boolean;
  includeTranscript?: boolean;
}

/** Best label for the other party: an explicit override, else the person named in a "YYMMDD - Name" title. */
export function themNameFor(note: Pick<Note, "title">, override?: string): string | undefined {
  return override ?? parseTitleSubject(note.title)?.person ?? undefined;
}

export function speakerLabel(item: TranscriptItem, opts: FormatOptions): string {
  const s = item.speaker;
  if (s.name) return s.name;
  if (s.attribution === "me") return opts.meName || "Me";
  if (s.attribution === "them") return opts.themName || "Them";
  if (s.diarization_label) return s.diarization_label;
  return s.source === "microphone" ? opts.meName || "Me" : opts.themName || "Them";
}

function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Render transcript items as "[hh:mm:ss] Speaker: text" lines, merging consecutive turns by the same speaker. */
export function formatTranscript(items: TranscriptItem[], opts: FormatOptions): string {
  if (!items.length) return "";
  const t0 = Date.parse(items[0].start_time);
  const merge = opts.mergeTurns ?? true;
  const ts = opts.timestamps ?? true;
  const lines: string[] = [];
  let curLabel = "";
  let curStart = 0;
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    const prefix = ts && Number.isFinite(t0) ? `[${hms(curStart - t0)}] ` : "";
    lines.push(`${prefix}${curLabel}: ${buf.join(" ")}`);
    buf = [];
  };
  for (const it of items) {
    const label = speakerLabel(it, opts);
    const text = it.text.trim();
    if (!text) continue;
    if (!merge || label !== curLabel) {
      flush();
      curLabel = label;
      curStart = Date.parse(it.start_time);
    }
    buf.push(text);
  }
  flush();
  return lines.join("\n");
}

export interface TranscriptStats {
  items: number;
  word_count: number;
  me_words: number;
  them_words: number;
  unattributed_words: number;
  speaker_names: string[];
  duration_minutes: number | null;
}

const wc = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function computeTranscriptStats(items: TranscriptItem[] | null | undefined): TranscriptStats {
  const stats: TranscriptStats = {
    items: 0,
    word_count: 0,
    me_words: 0,
    them_words: 0,
    unattributed_words: 0,
    speaker_names: [],
    duration_minutes: null,
  };
  if (!items?.length) return stats;
  const names = new Set<string>();
  for (const it of items) {
    const n = wc(it.text);
    stats.items += 1;
    stats.word_count += n;
    if (it.speaker.attribution === "me") stats.me_words += n;
    else if (it.speaker.attribution === "them") stats.them_words += n;
    else stats.unattributed_words += n;
    if (it.speaker.name) names.add(it.speaker.name.trim());
  }
  stats.speaker_names = [...names];
  const t0 = Date.parse(items[0].start_time);
  const t1 = Date.parse(items[items.length - 1].end_time);
  if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) stats.duration_minutes = Math.round((t1 - t0) / 60000);
  return stats;
}

export function noteHeader(note: Note): string {
  const attendees = note.attendees.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(", ");
  const folders = note.folder_membership.map((f) => f.name).join(", ");
  return [
    `# ${note.title ?? "(untitled)"}`,
    "",
    `- Date: ${note.created_at}`,
    `- Note ID: ${note.id}`,
    `- Owner: ${note.owner.name ?? ""} <${note.owner.email}>`,
    attendees ? `- Attendees: ${attendees}` : null,
    folders ? `- Folders: ${folders}` : null,
    note.calendar_event?.event_title ? `- Calendar event: ${note.calendar_event.event_title}` : null,
    `- Granola: ${note.web_url}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export function noteToMarkdown(note: Note, opts: FormatOptions): string {
  const parts: string[] = [noteHeader(note), ""];
  if ((opts.includeSummary ?? true) && (note.summary_markdown || note.summary_text)) {
    parts.push("## Summary", "", note.summary_markdown ?? note.summary_text, "");
  }
  if ((opts.includePrivateNotes ?? true) && (note.private_notes_markdown || note.private_notes_text)) {
    parts.push("## Private notes", "", note.private_notes_markdown ?? note.private_notes_text ?? "", "");
  }
  if (opts.includeTranscript ?? true) {
    if (note.transcript?.length) {
      parts.push("## Transcript", "", formatTranscript(note.transcript, opts), "");
    } else {
      parts.push("## Transcript", "", "_No transcript available for this note._", "");
    }
  }
  return parts.join("\n");
}

export function noteToPlainText(note: Note, opts: FormatOptions): string {
  return noteToMarkdown(note, { ...opts, timestamps: false }).replace(/^#+\s*/gm, "").replace(/^- /gm, "");
}

/** Rough token estimate for budgeting (about 3.7 characters per token for English transcript text). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.7);
}

export interface CorpusResult {
  text: string;
  tokens: number;
  noteCount: number;
  notesWithoutTranscript: number;
}

/** Concatenate notes into one XML-tagged corpus block suitable for an LLM context. */
export function buildCorpus(notes: Note[], opts: FormatOptions): CorpusResult {
  const blocks: string[] = [];
  let missing = 0;
  const sorted = [...notes].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const n of sorted) {
    const attendees = n.attendees.map((a) => a.name ?? a.email).join(", ");
    const lines: string[] = [];
    lines.push(`<meeting id="${n.id}" title=${JSON.stringify(n.title ?? "")} date="${isoDate(n.created_at)}" url="${n.web_url}">`);
    if (attendees) lines.push(`<attendees>${attendees}</attendees>`);
    if ((opts.includeSummary ?? true) && (n.summary_markdown || n.summary_text)) {
      lines.push("<summary>", n.summary_markdown ?? n.summary_text, "</summary>");
    }
    if ((opts.includePrivateNotes ?? true) && (n.private_notes_markdown || n.private_notes_text)) {
      lines.push("<private_notes>", n.private_notes_markdown ?? n.private_notes_text ?? "", "</private_notes>");
    }
    if (opts.includeTranscript ?? true) {
      if (n.transcript?.length) {
        lines.push("<transcript>", formatTranscript(n.transcript, { ...opts, themName: themNameFor(n, opts.themName) }), "</transcript>");
      } else {
        missing += 1;
        lines.push("<transcript>(none)</transcript>");
      }
    }
    lines.push("</meeting>");
    blocks.push(lines.join("\n"));
  }
  const text = blocks.join("\n\n");
  return { text, tokens: estimateTokens(text), noteCount: notes.length, notesWithoutTranscript: missing };
}
