import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config, type Effort } from "../config.js";
import { buildCorpus, contentFlags, normalizeContentMode, type ContentMode } from "../corpus/format.js";
import { loadNote, paths, type IndexEntry } from "../store/store.js";
import { askSystemPrompt } from "../prompts/ask.js";
import { providerFor, providerIdFor, type ProviderChat, type ProviderId, type UsageSummary } from "../llm/index.js";
import { describeSelection, hasSelector, resolveSelection, type SelectOptions } from "../commands/select.js";
import { nowStamp } from "../util.js";

export const ASK_HARD_LIMIT_TOKENS = 900_000;
export const ASK_CONFIRM_TOKENS = 300_000;

export interface AskSessionOptions {
  model?: string;
  effort?: Effort;
  /** Transcripts only (default), transcripts + notes, or notes only. */
  content?: ContentMode;
  includeSummary?: boolean;
  includePrivateNotes?: boolean;
  maxTokens?: number;
}

export interface AskSession {
  id: string;
  createdAt: string;
  selection: string;
  content: ContentMode;
  entries: IndexEntry[];
  corpusText: string;
  corpusTokens: number;
  notesWithoutTranscript: number;
  system: string;
  model: string;
  provider: ProviderId;
  effort: Effort;
  maxTokens: number;
  chat: ProviderChat;
  turns: Array<{ question: string; answer: string; usage: UsageSummary; model: string }>;
}

/** Build the corpus for a selection. Makes no LLM call. */
export function createAskSession(sel: SelectOptions, o: AskSessionOptions = {}): AskSession {
  if (!hasSelector(sel)) throw new Error("Choose notes with --ids, --search, --person, --since/--until or --folder.");
  const { index, entries } = resolveSelection(sel);
  if (!entries.length) throw new Error(`No notes match ${describeSelection(sel)}`);
  const meName = index.me.name ?? "Me";
  const notes = entries.map((e) => loadNote(e.id));
  const content = normalizeContentMode(o.content, "transcript");
  const flags = contentFlags(content, o.includePrivateNotes ?? true);
  const corpus = buildCorpus(notes, {
    meName,
    themName: sel.person,
    ...flags,
    includeSummary: flags.includeSummary && (o.includeSummary ?? true),
  });
  if (corpus.tokens > ASK_HARD_LIMIT_TOKENS) {
    throw new Error(
      `Corpus is ~${corpus.tokens.toLocaleString()} tokens, above the ${ASK_HARD_LIMIT_TOKENS.toLocaleString()} token limit. Narrow the selection.`,
    );
  }
  const model = o.model ?? config.llmModel;
  const effort = o.effort ?? config.llmEffort;
  const maxTokens = o.maxTokens ?? 64000;
  const system = askSystemPrompt(index.me);
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    selection: describeSelection(sel),
    content,
    entries: entries.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)),
    corpusText: corpus.text,
    corpusTokens: corpus.tokens,
    notesWithoutTranscript: corpus.notesWithoutTranscript,
    system,
    model,
    provider: providerIdFor(model),
    effort,
    maxTokens,
    chat: providerFor(model).createChat({ system, corpusText: corpus.text, model, effort, maxTokens }),
    turns: [],
  };
}

/** One question/answer turn; the provider keeps the history and the cached corpus. */
export async function askTurn(
  session: AskSession,
  question: string,
  onText?: (delta: string) => void,
): Promise<{ text: string; usage: UsageSummary; model: string }> {
  const res = await session.chat.ask(question, onText);
  session.turns.push({ question, answer: res.text, usage: res.usage, model: res.model });
  return { text: res.text, usage: res.usage, model: res.model };
}

export function conversationMarkdown(session: AskSession): string {
  const lines = [
    `# Conversation — ${session.createdAt}`,
    "",
    `Selection: ${session.selection} (content: ${session.content})`,
    `Notes (${session.entries.length}): ${session.entries.map((e) => `${e.id} "${e.title ?? ""}"`).join("; ")}`,
    `Model: ${session.model} (effort ${session.effort})`,
    "",
  ];
  for (const t of session.turns) lines.push("## You", "", t.question, "", "## Assistant", "", t.answer, "");
  return lines.join("\n");
}

export function saveConversation(session: AskSession): string | null {
  if (!session.turns.length) return null;
  fs.mkdirSync(paths.conversations(), { recursive: true });
  const file = path.join(paths.conversations(), `${nowStamp()}_${session.id.slice(0, 8)}.md`);
  fs.writeFileSync(file, conversationMarkdown(session));
  return file;
}
