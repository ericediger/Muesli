import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { Response, ResponseInputItem, ResponseOutputItem } from "openai/resources/responses/responses";
import type { z } from "zod";
import { config, requireOpenAIKey } from "../config.js";
import { log } from "../util.js";
import type { ChatOptions, CompleteOptions, ExtractOptions, ExtractResult, LlmProvider, ProviderChat, TurnResult, UsageSummary } from "./types.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = requireOpenAIKey();
  // Long transcripts at max reasoning effort can run well past the SDK's 10-minute default.
  if (!client) client = new OpenAI({ apiKey, timeout: 30 * 60 * 1000 });
  return client;
}

function usageFrom(u: Response["usage"]): UsageSummary {
  const cached = u?.input_tokens_details?.cached_tokens ?? 0;
  return {
    input_tokens: Math.max(0, (u?.input_tokens ?? 0) - cached),
    // Reasoning tokens are already counted in output_tokens.
    output_tokens: u?.output_tokens ?? 0,
    cache_read_input_tokens: cached,
    cache_creation_input_tokens: 0,
  };
}

/** Throw on refusals and content-filter stops; warn when the answer was cut off. */
function checkFinished(r: Response, what: string): void {
  for (const item of r.output) {
    if (item.type !== "message") continue;
    const refusal = item.content.find((c) => c.type === "refusal");
    if (refusal) throw new Error(`The model declined this ${what}: ${refusal.refusal}`);
  }
  if (r.status === "incomplete") {
    const reason = r.incomplete_details?.reason;
    if (reason === "content_filter") throw new Error(`OpenAI stopped the ${what} (content_filter).`);
    if (reason === "max_output_tokens") log("\n[warning] the answer was cut off at max output tokens");
  }
}

/** Assistant output worth replaying on the next turn: the message and its (encrypted) reasoning. */
function replayable(output: ResponseOutputItem[]): ResponseInputItem[] {
  return output.filter((o): o is Extract<ResponseOutputItem, { type: "message" | "reasoning" }> => o.type === "message" || o.type === "reasoning");
}

interface StreamArgs {
  system: string;
  input: ResponseInputItem[];
  model: string;
  effort: CompleteOptions["effort"];
  maxTokens: number;
  onText?: (delta: string) => void;
}

/**
 * Stream one response. Transcripts are not stored on OpenAI's side (store: false); reasoning comes
 * back encrypted so a follow-up can replay it. Prefixes over 1,024 tokens are cached automatically.
 */
async function stream(a: StreamArgs): Promise<TurnResult & { output: ResponseOutputItem[] }> {
  const s = getClient().responses.stream({
    model: a.model,
    instructions: a.system,
    input: a.input,
    reasoning: { effort: a.effort },
    max_output_tokens: a.maxTokens,
    store: false,
    include: ["reasoning.encrypted_content"],
  });
  let text = "";
  for await (const event of s) {
    if (event.type === "response.output_text.delta") {
      text += event.delta;
      a.onText?.(event.delta);
    }
  }
  const final = await s.finalResponse();
  checkFinished(final, "request");
  return { text, output: final.output, usage: usageFrom(final.usage), model: final.model, stopReason: final.incomplete_details?.reason ?? final.status ?? null };
}

function userMessage(texts: string[]): ResponseInputItem {
  return { role: "user", content: texts.map((text) => ({ type: "input_text" as const, text })) };
}

class OpenAIChat implements ProviderChat {
  readonly model: string;
  private readonly input: ResponseInputItem[] = [];
  constructor(private readonly o: ChatOptions) {
    this.model = o.model;
  }
  async ask(question: string, onText?: (delta: string) => void): Promise<TurnResult> {
    // The corpus rides along with the first question and stays first in the input, so it is cached for follow-ups.
    const first = this.input.length === 0;
    this.input.push(first ? userMessage([`<corpus>\n${this.o.corpusText}\n</corpus>`, question]) : userMessage([question]));
    try {
      const r = await stream({
        system: this.o.system,
        input: this.input,
        model: this.o.model,
        effort: this.o.effort,
        maxTokens: this.o.maxTokens ?? 64000,
        onText,
      });
      this.input.push(...replayable(r.output));
      return r;
    } catch (err) {
      this.input.pop(); // keep history consistent for a retry
      throw err;
    }
  }
}

export const openaiProvider: LlmProvider = {
  id: "openai",

  configured: () => Boolean(config.openaiApiKey),

  async complete(o: CompleteOptions): Promise<TurnResult> {
    return stream({
      system: o.system,
      input: [userMessage(o.blocks.map((b) => b.text))],
      model: o.model,
      effort: o.effort,
      maxTokens: o.maxTokens ?? 64000,
      onText: o.onText,
    });
  },

  createChat(o: ChatOptions): ProviderChat {
    return new OpenAIChat(o);
  },

  async extractStructured<S extends z.ZodType>(o: ExtractOptions<S>): Promise<ExtractResult<z.infer<S>>> {
    const res = await getClient().responses.parse({
      model: o.model,
      instructions: o.system,
      input: o.user,
      reasoning: { effort: o.effort },
      max_output_tokens: o.maxTokens ?? 16000,
      store: false,
      text: { format: zodTextFormat(o.schema, "extraction") },
    });
    checkFinished(res, "extraction");
    if (!res.output_parsed) throw new Error("OpenAI returned no parseable structured output.");
    return { data: res.output_parsed as z.infer<S>, usage: usageFrom(res.usage), model: res.model };
  },

  async countTokens(system: string, text: string, model: string): Promise<number | null> {
    try {
      const r = await getClient().responses.inputTokens.count({ model, instructions: system, input: text });
      return r.input_tokens;
    } catch {
      return null;
    }
  },

  async checkModel(model: string) {
    const m = await getClient().models.retrieve(model);
    return { id: m.id, display_name: m.id };
  },

  reset() {
    client = null;
  },
};
