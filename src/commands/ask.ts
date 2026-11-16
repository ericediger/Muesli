import readline from "node:readline/promises";
import type { Command } from "commander";
import { addSelectOptions, type SelectOptions } from "./select.js";
import { ASK_CONFIRM_TOKENS, askTurn, createAskSession, saveConversation } from "../services/ask.js";
import { formatUsage } from "../llm/index.js";
import type { Effort } from "../config.js";
import { isoDate, log } from "../util.js";
import { normalizeContentMode } from "../corpus/format.js";

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const a = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  rl.close();
  return a === "y" || a === "yes";
}

export function registerAsk(program: Command): void {
  addSelectOptions(
    program
      .command("ask [question]")
      .description("Ask the LLM a question over an explicit set of transcripts; --chat keeps the corpus loaded for follow-ups")
      .option("--chat", "interactive follow-up questions over the same corpus")
      .option("--model <id>", "override LLM_MODEL")
      .option("--effort <level>", "low | medium | high | xhigh | max")
      .option("--max-tokens <n>", "max output tokens", "64000")
      .option("--content <mode>", "transcript | both | notes (both adds the AI summary and private notes; notes = those two only)", "transcript")
      .option("--no-summary", "exclude Granola AI summaries from the corpus")
      .option("--no-private", "exclude your private notes from the corpus")
      .option("--dry-run", "show what would be sent (notes, token estimate) and exit")
      .option("-y, --yes", "skip the large-corpus confirmation")
      .option("--no-save", "do not save the conversation under data/conversations"),
  ).action(
    async (
      question: string | undefined,
      o: SelectOptions & {
        chat?: boolean;
        model?: string;
        effort?: string;
        maxTokens: string;
        content?: string;
        summary: boolean;
        private: boolean;
        dryRun?: boolean;
        yes?: boolean;
        save: boolean;
      },
    ) => {
      if (!question && !o.chat) throw new Error("Give a question, or pass --chat for an interactive session.");
      const session = createAskSession(o, {
        model: o.model,
        effort: o.effort as Effort | undefined,
        content: normalizeContentMode(o.content),
        includeSummary: o.summary,
        includePrivateNotes: o.private,
        maxTokens: Number(o.maxTokens) || 64000,
      });
      log(`Corpus (${session.content}): ${session.entries.length} note(s), ~${session.corpusTokens.toLocaleString()} tokens${session.notesWithoutTranscript ? `, ${session.notesWithoutTranscript} without transcript` : ""} — ${session.selection}`);
      for (const e of session.entries) log(`  ${isoDate(e.created_at)}  ${e.id}  ${e.title ?? "(untitled)"}  (${e.word_count} words)`);
      if (o.dryRun) return;
      if (session.corpusTokens > ASK_CONFIRM_TOKENS && !o.yes) {
        if (!(await confirm(`This is a large corpus (~${session.corpusTokens.toLocaleString()} tokens). Continue?`))) return;
      }

      const turn = async (q: string) => {
        const res = await askTurn(session, q, (t) => process.stdout.write(t));
        process.stdout.write("\n");
        log(formatUsage(res.usage, res.model));
      };

      if (question) await turn(question);
      if (o.chat) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
        log("Interactive mode. Type a question; /exit to quit.");
        for (;;) {
          let q: string;
          try {
            q = (await rl.question("\nyou> ")).trim();
          } catch {
            break;
          }
          if (!q) continue;
          if (q === "/exit" || q === "/quit") break;
          await turn(q);
        }
        rl.close();
      }
      if (o.save) {
        const file = saveConversation(session);
        if (file) log(`Saved conversation to ${file}`);
      }
    },
  );
}
