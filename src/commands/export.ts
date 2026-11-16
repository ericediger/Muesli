import type { Command } from "commander";
import { addSelectOptions, type SelectOptions } from "./select.js";
import { exportNotes, type ExportFormat } from "../services/export.js";
import { log } from "../util.js";
import { normalizeContentMode } from "../corpus/format.js";

export function registerExport(program: Command): void {
  addSelectOptions(
    program
      .command("export")
      .description("Write selected notes and transcripts to files")
      .option("--format <fmt>", "md | txt | json", "md")
      .option("-o, --out <dir>", "output directory (default: data/exports/<timestamp>)")
      .option("--bundle", "write one combined file instead of one file per note")
      .option("--content <mode>", "both | transcript | notes (notes = AI summary + private notes)", "both")
      .option("--no-timestamps", "omit [hh:mm:ss] prefixes in transcripts")
      .option("--all", "export the entire archive"),
  ).action((o: SelectOptions & { format: string; out?: string; bundle?: boolean; timestamps: boolean; all?: boolean; content?: string }) => {
    const r = exportNotes({ ...o, format: o.format as ExportFormat, content: normalizeContentMode(o.content) });
    log(`Wrote ${r.count} note(s) as ${r.files.length} file(s) to ${r.outDir}`);
    console.log(r.outDir);
  });
}
