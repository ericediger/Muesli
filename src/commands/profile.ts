import type { Command } from "commander";
import type { Effort } from "../config.js";
import { buildProfile, describeProfileSelection, selectProfileMeetings } from "../services/profile.js";
import { normalizeContentMode } from "../corpus/format.js";
import { formatUsage } from "../llm/index.js";
import { isoDate, log } from "../util.js";

interface ProfileCliOptions {
  ids?: string;
  plusAuto?: boolean;
  content?: string;
  email?: string;
  since?: string;
  until?: string;
  group: boolean;
  corpus: boolean;
  concurrency: string;
  model?: string;
  extractModel?: string;
  effort?: string;
  extractEffort?: string;
  out?: string;
  dryRun?: boolean;
  refresh?: boolean;
}

export function registerProfile(program: Command): void {
  program
    .command("profile <name>")
    .description("Build an EQ / IQ / professional working profile of a person from the transcripts of your meetings with them")
    .option("--email <email>", "attendee email that identifies the person")
    .option("--ids <ids>", "use these note IDs (comma-separated) instead of auto-detecting meetings")
    .option("--plus-auto", "with --ids: also add auto-detected meetings with the person")
    .option("--content <mode>", "transcript | both | notes (both adds the AI summary and private notes; notes = those two only)", "transcript")
    .option("--since <date>", "YYYY-MM-DD or relative (6m, 1y)")
    .option("--until <date>", "YYYY-MM-DD")
    .option("--no-group", "auto-detect one-on-ones only (group meetings are included by default)")
    .option("--no-corpus", "synthesize from extracted evidence only (cheaper; no raw transcripts in the final step)")
    .option("-c, --concurrency <n>", "parallel per-meeting extractions", "3")
    .option("--model <id>", "model for the final synthesis (default LLM_MODEL)")
    .option("--extract-model <id>", "model for per-meeting extraction (default LLM_EXTRACT_MODEL)")
    .option("--effort <level>", "effort for the synthesis call: low | medium | high | xhigh | max (default LLM_EFFORT)")
    .option("--extract-effort <level>", "effort for per-meeting extraction (default LLM_EXTRACT_EFFORT)")
    .option("-o, --out <file>", "write the profile Markdown here (default data/profiles/<person>/…)")
    .option("--refresh", "re-extract evidence even if cached")
    .option("--dry-run", "list the meetings that would be used and exit")
    .action(async (name: string, o: ProfileCliOptions) => {
      const opts = {
        name,
        email: o.email,
        ids: o.ids ? o.ids.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        plusAuto: o.plusAuto,
        content: normalizeContentMode(o.content, "transcript"),
        since: o.since,
        until: o.until,
        includeGroup: o.group,
        corpus: o.corpus,
        concurrency: Number(o.concurrency) || 3,
        model: o.model,
        extractModel: o.extractModel,
        effort: o.effort as Effort | undefined,
        extractEffort: o.extractEffort as Effort | undefined,
        out: o.out,
        refresh: o.refresh,
      };
      const sel = selectProfileMeetings(opts);
      log(describeProfileSelection(name, sel));
      if (sel.missing.length) log(`  ignored (not archived / no transcript): ${sel.missing.join(", ")}`);
      for (const c of sel.selected) {
        const share = c.entry.me_word_share === null ? "?" : `${Math.round(c.entry.me_word_share * 100)}%`;
        log(`  ${isoDate(c.entry.created_at)}  ${c.entry.id}  ${c.kind.padEnd(10)}  ${c.entry.title ?? "(untitled)"}  (${c.entry.word_count} words, me ${share})`);
      }
      if (!sel.selected.length) {
        throw new Error(`No usable meetings for "${name}". Try: npm run granola -- people   (to see detected names), or --ids.`);
      }
      if (o.dryRun) return;
      const r = await buildProfile(opts, { log, onText: (t) => process.stdout.write(t) });
      process.stdout.write("\n");
      log(formatUsage(r.usage, `total; synthesis=${r.model}`));
    });
}
