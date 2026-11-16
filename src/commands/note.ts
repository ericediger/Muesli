import type { Command } from "commander";
import { config, requireGranolaKey } from "../config.js";
import { GranolaClient } from "../granola/client.js";
import { noteToMarkdown, themNameFor } from "../corpus/format.js";
import { hasNote, loadIndex, loadNote, rebuildIndex, saveNote } from "../store/store.js";

export function registerNote(program: Command): void {
  program
    .command("note <id>")
    .description("Print one note (summary, private notes, transcript) as Markdown")
    .option("--json", "print the stored JSON instead")
    .option("--fetch", "download from Granola even if already stored")
    .action(async (id: string, o: { json?: boolean; fetch?: boolean }) => {
      if (o.fetch || !hasNote(id)) {
        const client = new GranolaClient({ apiKey: requireGranolaKey(), baseUrl: config.granolaBaseUrl });
        const { note, transcriptSource } = await client.getNoteWithTranscript(id);
        saveNote(note, { fetched_at: new Date().toISOString(), transcript_source: transcriptSource });
        rebuildIndex();
      }
      const note = loadNote(id);
      if (o.json) {
        console.log(JSON.stringify(note, null, 2));
        return;
      }
      const index = loadIndex();
      console.log(noteToMarkdown(note, { meName: index.me.name ?? "Me", themName: themNameFor(note) }));
    });
}
