import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { GranolaUser, Note } from "../granola/types.js";
import { computeTranscriptStats } from "../corpus/format.js";
import { parseTitleSubject, personMatchesEntry, textHasAllTokens, nameTokens } from "../people/people.js";

export interface StoredNote extends Note {
  /** transcript_source "import" marks a note built from a pasted transcript (imp_ id, no Granola link). */
  _meta: { fetched_at: string; transcript_source: "inline" | "paginated" | "none" | "import"; import_file?: string };
}

export interface IndexEntry {
  id: string;
  title: string | null;
  title_person: string | null;
  created_at: string;
  updated_at: string;
  owner: GranolaUser;
  web_url: string;
  attendees: GranolaUser[];
  folder_ids: string[];
  folder_names: string[];
  summary_text: string;
  has_private_notes: boolean;
  has_transcript: boolean;
  transcript_items: number;
  word_count: number;
  me_word_share: number | null;
  duration_minutes: number | null;
  speaker_names: string[];
  fetched_at: string;
}

export interface Index {
  version: 1;
  updated_at: string;
  last_sync_at: string | null;
  me: { email: string | null; name: string | null };
  notes: IndexEntry[];
}

export const paths = {
  root: () => config.dataDir,
  notes: () => path.join(config.dataDir, "notes"),
  index: () => path.join(config.dataDir, "index.json"),
  exports: () => path.join(config.dataDir, "exports"),
  profiles: () => path.join(config.dataDir, "profiles"),
  conversations: () => path.join(config.dataDir, "conversations"),
  inbox: () => config.inboxDir,
};

export function ensureDirs(): void {
  for (const p of [paths.root(), paths.notes(), paths.exports(), paths.profiles(), paths.conversations()]) {
    fs.mkdirSync(p, { recursive: true });
  }
}

export function notePath(id: string): string {
  return path.join(paths.notes(), `${id}.json`);
}

export function hasNote(id: string): boolean {
  return fs.existsSync(notePath(id));
}

export function saveNote(note: Note, meta: StoredNote["_meta"]): StoredNote {
  ensureDirs();
  const stored: StoredNote = { ...note, _meta: meta };
  fs.writeFileSync(notePath(note.id), JSON.stringify(stored, null, 2));
  return stored;
}

export function loadNote(id: string): StoredNote {
  const p = notePath(id);
  if (!fs.existsSync(p)) throw new Error(`Note ${id} is not in the local archive. Run: npm run granola -- sync`);
  return JSON.parse(fs.readFileSync(p, "utf8")) as StoredNote;
}

export function listStoredIds(): string[] {
  if (!fs.existsSync(paths.notes())) return [];
  return fs
    .readdirSync(paths.notes())
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5));
}

export function entryFromNote(note: StoredNote): IndexEntry {
  const stats = computeTranscriptStats(note.transcript);
  const attributed = stats.me_words + stats.them_words;
  return {
    id: note.id,
    title: note.title,
    title_person: parseTitleSubject(note.title)?.person ?? null,
    created_at: note.created_at,
    updated_at: note.updated_at,
    owner: note.owner,
    web_url: note.web_url,
    attendees: note.attendees ?? [],
    folder_ids: (note.folder_membership ?? []).map((f) => f.id),
    folder_names: (note.folder_membership ?? []).map((f) => f.name),
    summary_text: note.summary_text ?? "",
    has_private_notes: Boolean(note.private_notes_text || note.private_notes_markdown),
    has_transcript: stats.items > 0,
    transcript_items: stats.items,
    word_count: stats.word_count,
    me_word_share: attributed > 0 ? Number((stats.me_words / attributed).toFixed(3)) : null,
    duration_minutes: stats.duration_minutes,
    speaker_names: stats.speaker_names,
    fetched_at: note._meta.fetched_at,
  };
}

export function emptyIndex(): Index {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    last_sync_at: null,
    me: { email: config.meEmail || null, name: config.meName || null },
    notes: [],
  };
}

export function loadIndex(): Index {
  const p = paths.index();
  if (!fs.existsSync(p)) return emptyIndex();
  return JSON.parse(fs.readFileSync(p, "utf8")) as Index;
}

export function saveIndex(index: Index): void {
  ensureDirs();
  index.updated_at = new Date().toISOString();
  index.notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
  fs.writeFileSync(paths.index(), JSON.stringify(index, null, 2));
}

/** Rebuild the index from every note file on disk (keeps last_sync_at). */
export function rebuildIndex(previous?: Index): Index {
  const idx = previous ?? loadIndex();
  const entries: IndexEntry[] = [];
  const ownerCounts = new Map<string, { n: number; name: string | null }>();
  for (const id of listStoredIds()) {
    const note = loadNote(id);
    entries.push(entryFromNote(note));
    const k = note.owner.email.toLowerCase();
    const c = ownerCounts.get(k) ?? { n: 0, name: note.owner.name };
    c.n += 1;
    ownerCounts.set(k, c);
  }
  idx.notes = entries;
  // "me" = explicit override, else the most common note owner (the API key holder's own notes).
  if (!config.meEmail && ownerCounts.size) {
    const [email, info] = [...ownerCounts.entries()].sort((a, b) => b[1].n - a[1].n)[0];
    idx.me = { email, name: config.meName || info.name };
  } else {
    idx.me = { email: config.meEmail || idx.me.email, name: config.meName || idx.me.name };
  }
  saveIndex(idx);
  return idx;
}

export type SearchField = "title" | "summary" | "people" | "folders" | "transcript";
export const SEARCH_FIELDS: SearchField[] = ["title", "summary", "people", "folders", "transcript"];
export const DEFAULT_SEARCH_FIELDS: SearchField[] = ["title", "summary", "people", "folders"];

/** Keep only recognised field names; returns undefined when nothing valid remains. */
export function normalizeFields(v: unknown): SearchField[] | undefined {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  const out = arr.map((x) => String(x).trim().toLowerCase()).filter((x): x is SearchField => (SEARCH_FIELDS as string[]).includes(x));
  return out.length ? [...new Set(out)] : undefined;
}

export interface SearchFilter {
  q?: string;
  /** Which fields `q` is matched against. Default: title, summary, people, folders. */
  fields?: SearchField[];
  ids?: string[];
  since?: string;
  until?: string;
  folder?: string;
  person?: { name: string; email?: string };
  deep?: boolean;
  limit?: number;
}

/** Filter index entries. `deep` also scans transcript text (loads note files). */
export function searchIndex(index: Index, f: SearchFilter): IndexEntry[] {
  let out = index.notes;
  if (f.ids?.length) {
    const set = new Set(f.ids);
    out = out.filter((e) => set.has(e.id));
  }
  if (f.since) out = out.filter((e) => e.created_at >= f.since!);
  if (f.until) out = out.filter((e) => e.created_at <= f.until!);
  if (f.folder) {
    const needle = f.folder.toLowerCase();
    out = out.filter((e) => e.folder_ids.includes(f.folder!) || e.folder_names.some((n) => n.toLowerCase().includes(needle)));
  }
  if (f.person) out = out.filter((e) => personMatchesEntry(e, f.person!, index.me).match);
  if (f.q) {
    const fields = new Set<SearchField>(f.fields?.length ? f.fields : DEFAULT_SEARCH_FIELDS);
    if (f.deep) fields.add("transcript");
    const tokens = nameTokens(f.q).length ? f.q.toLowerCase().split(/\s+/).filter(Boolean) : [f.q.toLowerCase()];
    out = out.filter((e) => {
      const parts: string[] = [];
      if (fields.has("title")) parts.push(e.title ?? "");
      if (fields.has("summary")) parts.push(e.summary_text);
      if (fields.has("people")) parts.push(e.title_person ?? "", e.attendees.map((a) => `${a.name ?? ""} ${a.email}`).join(" "), e.speaker_names.join(" "));
      if (fields.has("folders")) parts.push(e.folder_names.join(" "));
      const hay = parts.join("\n");
      if (hay.trim() && (textHasAllTokens(hay, tokens) || tokens.every((t) => hay.toLowerCase().includes(t)))) return true;
      if (!fields.has("transcript")) return false;
      const note = loadNote(e.id);
      const tx = (note.transcript ?? []).map((t) => t.text).join("\n").toLowerCase();
      return tokens.every((t) => tx.includes(t));
    });
  }
  out = [...out].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (f.limit) out = out.slice(0, f.limit);
  return out;
}
