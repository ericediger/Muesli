import type { Command } from "commander";
import { loadIndex, normalizeFields, searchIndex, type Index, type IndexEntry } from "../store/store.js";
import { parseSince } from "../util.js";

export interface SelectOptions {
  ids?: string;
  search?: string;
  /** Fields to match --search against: title, summary, people, folders, transcript. */
  in?: string | string[];
  deep?: boolean;
  person?: string;
  email?: string;
  since?: string;
  until?: string;
  folder?: string;
  limit?: string;
}

export function addSelectOptions(cmd: Command): Command {
  return cmd
    .option("--ids <ids>", "comma-separated note IDs (not_...)")
    .option("-s, --search <text>", "text to find; use --in to choose where")
    .option("--in <fields>", "where --search looks: title,summary,people,folders,transcript (default title,summary,people,folders)")
    .option("--deep", "with --search: also scan transcript text (same as adding transcript to --in)")
    .option("-p, --person <name>", "meetings with this person (title convention, attendees, or speaker tags)")
    .option("--email <email>", "attendee email to match alongside --person")
    .option("--since <date>", "YYYY-MM-DD or relative (30d, 6m, 1y)")
    .option("--until <date>", "YYYY-MM-DD")
    .option("-f, --folder <idOrName>", "folder ID (fol_...) or a folder-name substring")
    .option("-n, --limit <n>", "maximum number of notes");
}

export function hasSelector(o: SelectOptions): boolean {
  return Boolean(o.ids || o.search || o.person || o.since || o.until || o.folder);
}

export function resolveSelection(o: SelectOptions): { index: Index; entries: IndexEntry[] } {
  const index = loadIndex();
  if (index.notes.length === 0) {
    throw new Error("The local archive is empty. Run: npm run granola -- sync");
  }
  const entries = searchIndex(index, {
    ids: o.ids ? o.ids.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    q: o.search,
    fields: normalizeFields(o.in),
    deep: o.deep,
    person: o.person ? { name: o.person, email: o.email } : undefined,
    since: parseSince(o.since),
    until: o.until ? parseSince(o.until) : undefined,
    folder: o.folder,
    limit: o.limit ? Number(o.limit) : undefined,
  });
  return { index, entries };
}

export function describeSelection(o: SelectOptions): string {
  const parts: string[] = [];
  if (o.ids) parts.push(`ids=${o.ids}`);
  if (o.search) {
    const f = normalizeFields(o.in);
    parts.push(`search="${o.search}"${f ? ` in ${f.join(",")}` : ""}${o.deep ? " (+transcript)" : ""}`);
  }
  if (o.person) parts.push(`person="${o.person}"${o.email ? ` <${o.email}>` : ""}`);
  if (o.since) parts.push(`since=${o.since}`);
  if (o.until) parts.push(`until=${o.until}`);
  if (o.folder) parts.push(`folder=${o.folder}`);
  if (o.limit) parts.push(`limit=${o.limit}`);
  return parts.join(" ") || "(all notes)";
}
