import type { Command } from "commander";
import { config, requireGranolaKey } from "../config.js";
import { GranolaClient } from "../granola/client.js";
import { loadIndex } from "../store/store.js";
import { table } from "../util.js";

export function registerFolders(program: Command): void {
  program
    .command("folders")
    .description("List folders visible to the API key, with local note counts")
    .action(async () => {
      const client = new GranolaClient({ apiKey: requireGranolaKey(), baseUrl: config.granolaBaseUrl });
      const folders = await client.listFolders();
      const index = loadIndex();
      const counts = new Map<string, number>();
      for (const n of index.notes) for (const id of n.folder_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
      const byId = new Map(folders.map((f) => [f.id, f]));
      const rows = folders.map((f) => ({
        id: f.id,
        name: f.name,
        parent: f.parent_folder_id ? (byId.get(f.parent_folder_id)?.name ?? f.parent_folder_id) : "",
        stored_notes: counts.get(f.id) ?? 0,
      }));
      console.log(rows.length ? table(rows, ["id", "name", "parent", "stored_notes"]) : "No folders visible.");
    });
}
