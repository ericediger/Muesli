import type { Command } from "commander";
import { syncArchive } from "../services/sync.js";
import { log } from "../util.js";

export function registerSync(program: Command): void {
  program
    .command("sync")
    .description("Download notes and transcripts into the local archive (incremental by default)")
    .option("--since <date>", "only notes created after this date (YYYY-MM-DD or 30d/6m/1y)")
    .option("--until <date>", "only notes created before this date")
    .option("-f, --folder <folderId>", "only notes in this folder (fol_...) and its subfolders")
    .option("--full", "list the entire history instead of only notes updated since the last sync")
    .option("--refresh", "re-download notes that are already stored")
    .option("-n, --limit <n>", "stop after listing this many notes")
    .option("-c, --concurrency <n>", "parallel note downloads", "4")
    .action(async (o: { since?: string; until?: string; folder?: string; full?: boolean; refresh?: boolean; limit?: string; concurrency: string }) => {
      const r = await syncArchive(
        { ...o, limit: o.limit ? Number(o.limit) : undefined, concurrency: Number(o.concurrency) || 4 },
        log,
      );
      log(`This run: inline=${r.counts.inline} paginated=${r.counts.paginated} none=${r.counts.none} failed=${r.counts.failed}. me=${r.me.name ?? "?"} <${r.me.email ?? "?"}>`);
    });
}
