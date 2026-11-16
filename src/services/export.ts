import fs from "node:fs";
import path from "node:path";
import { contentFlags, noteToMarkdown, noteToPlainText, normalizeContentMode, themNameFor, type ContentMode, type FormatOptions } from "../corpus/format.js";
import { loadNote, paths } from "../store/store.js";
import { describeSelection, hasSelector, resolveSelection, type SelectOptions } from "../commands/select.js";
import { isoDate, nowStamp, slugify } from "../util.js";

export type ExportFormat = "md" | "txt" | "json";

export interface ExportOptions extends SelectOptions {
  format?: ExportFormat;
  out?: string;
  bundle?: boolean;
  timestamps?: boolean;
  all?: boolean;
  /** transcripts + notes (default), transcripts only, or notes only. Ignored for json. */
  content?: ContentMode;
}

export interface ExportResult {
  outDir: string;
  files: string[];
  count: number;
  selection: string;
}

export function exportNotes(o: ExportOptions): ExportResult {
  if (!hasSelector(o) && !o.all) {
    throw new Error("Choose notes with --ids, --search, --person, --since/--until or --folder (or pass --all).");
  }
  const fmt: ExportFormat = o.format ?? "md";
  if (!["md", "txt", "json"].includes(fmt)) throw new Error(`Unknown format "${fmt}"`);
  const { index, entries } = resolveSelection(o);
  if (!entries.length) throw new Error(`No notes match ${describeSelection(o)}`);

  const outDir = path.resolve(o.out ?? path.join(paths.exports(), nowStamp()));
  fs.mkdirSync(outDir, { recursive: true });
  const fopts: FormatOptions = { meName: index.me.name ?? "Me", timestamps: o.timestamps ?? true, ...contentFlags(normalizeContentMode(o.content)) };
  const render = (id: string): string => {
    const note = loadNote(id);
    if (fmt === "json") return JSON.stringify(note, null, 2);
    const opts = { ...fopts, themName: themNameFor(note, o.person) };
    return fmt === "txt" ? noteToPlainText(note, opts) : noteToMarkdown(note, opts);
  };

  const files: string[] = [];
  if (o.bundle) {
    const body = entries
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => render(e.id))
      .join(fmt === "json" ? ",\n" : "\n\n---\n\n");
    const file = path.join(outDir, `bundle.${fmt}`);
    fs.writeFileSync(file, fmt === "json" ? `[\n${body}\n]` : body);
    files.push(file);
  } else {
    for (const e of entries) {
      const name = `${isoDate(e.created_at)}_${slugify(e.title ?? "untitled") || "untitled"}_${e.id}.${fmt}`;
      const file = path.join(outDir, name);
      fs.writeFileSync(file, render(e.id));
      files.push(file);
    }
  }
  const manifest = {
    exported_at: new Date().toISOString(),
    selection: describeSelection(o),
    format: fmt,
    content: normalizeContentMode(o.content),
    notes: entries.map((e) => ({ id: e.id, title: e.title, created_at: e.created_at, web_url: e.web_url })),
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { outDir, files, count: entries.length, selection: describeSelection(o) };
}
