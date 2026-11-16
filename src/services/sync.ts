import { config, requireGranolaKey } from "../config.js";
import { GranolaClient } from "../granola/client.js";
import type { ListNotesParams } from "../granola/types.js";
import { hasNote, loadIndex, loadNote, rebuildIndex, saveIndex, saveNote } from "../store/store.js";
import { pLimit, parseSince } from "../util.js";

export interface SyncOptions {
  since?: string;
  until?: string;
  folder?: string;
  full?: boolean;
  refresh?: boolean;
  limit?: number;
  concurrency?: number;
}

export interface SyncResult {
  listed: number;
  downloaded: number;
  skipped: number;
  counts: { inline: number; paginated: number; none: number; failed: number };
  archiveNotes: number;
  withTranscripts: number;
  me: { name: string | null; email: string | null };
}

export async function syncArchive(o: SyncOptions, log: (msg: string) => void): Promise<SyncResult> {
  const client = new GranolaClient({ apiKey: requireGranolaKey(), baseUrl: config.granolaBaseUrl });
  const index = loadIndex();
  const startedAt = new Date().toISOString();

  const params: ListNotesParams = {};
  if (o.since) params.created_after = parseSince(o.since);
  if (o.until) params.created_before = parseSince(o.until);
  if (o.folder) params.folder_id = o.folder;
  const incremental = !o.full && !o.since && !o.until && !o.folder && index.last_sync_at;
  if (incremental) {
    const d = new Date(index.last_sync_at!);
    d.setDate(d.getDate() - 1); // one-day overlap so late summary edits are not missed
    params.updated_after = d.toISOString();
  }
  log(incremental ? `Listing notes updated since ${params.updated_after!.slice(0, 10)}…` : "Listing notes…");

  const summaries = await client.listAllNotes(params, o.limit);
  log(`Listed ${summaries.length} note(s).`);

  const toFetch = summaries.filter((s) => {
    if (o.refresh || !hasNote(s.id)) return true;
    const stored = loadNote(s.id);
    return stored.updated_at < s.updated_at || !stored.transcript;
  });
  log(`${toFetch.length} to download, ${summaries.length - toFetch.length} already current.`);

  const run = pLimit(Math.max(1, o.concurrency ?? 4));
  let done = 0;
  const counts = { inline: 0, paginated: 0, none: 0, failed: 0 };
  await Promise.all(
    toFetch.map((s) =>
      run(async () => {
        try {
          const { note, transcriptSource } = await client.getNoteWithTranscript(s.id);
          saveNote(note, { fetched_at: new Date().toISOString(), transcript_source: transcriptSource });
          counts[transcriptSource] += 1;
        } catch (err) {
          counts.failed += 1;
          log(`Failed ${s.id} "${s.title ?? ""}": ${(err as Error).message}`);
        } finally {
          done += 1;
          if (done % 10 === 0 || done === toFetch.length) log(`${done}/${toFetch.length} downloaded`);
        }
      }),
    ),
  );

  const rebuilt = rebuildIndex(index);
  if (!o.limit && !o.since && !o.until && !o.folder) rebuilt.last_sync_at = startedAt;
  saveIndex(rebuilt);
  const withTranscripts = rebuilt.notes.filter((n) => n.has_transcript).length;
  log(`Done. Archive has ${rebuilt.notes.length} notes (${withTranscripts} with transcripts).`);
  return {
    listed: summaries.length,
    downloaded: toFetch.length - counts.failed,
    skipped: summaries.length - toFetch.length,
    counts,
    archiveNotes: rebuilt.notes.length,
    withTranscripts,
    me: rebuilt.me,
  };
}
