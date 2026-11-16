import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { config, requireAnthropicKey } from "../config.js";
import { log } from "../util.js";
import type { ChatOptions, CompleteOptions, ExtractOptions, ExtractResult, LlmProvider, ProviderChat, TurnResult, UsageSummary } from "./types.js";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  requireAnthropicKey();
  if (!client) client = new Anthropic();
  return client;
}

function summarizeUsage(u: Anthropic.Usage | Anthropic.Beta.BetaUsage): UsageSummary {
  return {
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
  };
}

interface StreamArgs {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  model: string;
  effort: CompleteOptions["effort"];
  maxTokens: number;
  onText?: (delta: string) => void;
}

/**
 * Stream one completion. The system prompt and any `cache_control` blocks in
 * `messages` are cached for an hour; server-side refusal fallbacks are on.
 */
async function stream(a: StreamArgs): Promise<TurnResult & { content: Anthropic.Beta.BetaContentBlock[] }> {
  const c = getClient();
  const s = c.beta.messages.stream({
    model: a.model,
    max_tokens: a.maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: a.system, cache_control: { type: "ephemeral", ttl: "1h" } }],
    messages: a.messages,
    output_config: { effort: a.effort },
  });
  let text = "";
  for await (const event of s) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      a.onText?.(event.delta.text);
    }
  }
  const final = await s.finalMessage();
  if (final.stop_reason === "refusal") {
    throw new Error("The model declined this request (stop_reason=refusal), even after the server-side fallback.");
  }
  if (final.stop_reason === "max_tokens") log("\n[warning] the answer was cut off at max_tokens; re-run with a higher --max-tokens");
  return { text, content: final.content, stopReason: final.stop_reason, usage: summarizeUsage(final.usage), model: final.model };
}

function toBlocks(blocks: CompleteOptions["blocks"]): Anthropic.Beta.BetaContentBlockParam[] {
  return blocks.map((b) =>
    b.cache
      ? { type: "text", text: b.text, cache_control: { type: "ephemeral", ttl: "1h" } }
      : { type: "text", text: b.text },
  );
}

class AnthropicChat implements ProviderChat {
  readonly model: string;
  private readonly messages: Anthropic.Beta.BetaMessageParam[] = [];
  constructor(private readonly o: ChatOptions) {
    this.model = o.model;
  }
  async ask(question: string, onText?: (delta: string) => void): Promise<TurnResult> {
    const first = this.messages.length === 0;
    const content = first
      ? toBlocks([{ text: `<corpus>\n${this.o.corpusText}\n</corpus>`, cache: true }, { text: question }])
      : toBlocks([{ text: question }]);
    this.messages.push({ role: "user", content });
    try {
      const r = await stream({
        system: this.o.system,
        messages: this.messages,
        model: this.o.model,
        effort: this.o.effort,
        maxTokens: this.o.maxTokens ?? 64000,
        onText,
      });
      this.messages.push({ role: "assistant", content: r.content });
      return r;
    } catch (err) {
      this.messages.pop(); // keep history consistent for a retry
      throw err;
    }
  }
}

export const anthropicProvider: LlmProvider = {
  id: "anthropic",

  configured: () => Boolean(config.anthropicApiKey || process.env.ANTHROPIC_AUTH_TOKEN),

  async complete(o: CompleteOptions): Promise<TurnResult> {
    return stream({
      system: o.system,
      messages: [{ role: "user", content: toBlocks(o.blocks) }],
      model: o.model,
      effort: o.effort,
      maxTokens: o.maxTokens ?? 64000,
      onText: o.onText,
    });
  },

  createChat(o: ChatOptions): ProviderChat {
    return new AnthropicChat(o);
  },

  async extractStructured<S extends z.ZodType>(o: ExtractOptions<S>): Promise<ExtractResult<z.infer<S>>> {
    const c = getClient();
    const res = await c.messages.parse({
      model: o.model,
      max_tokens: o.maxTokens ?? 16000,
      system: o.system,
      messages: [{ role: "user", content: o.user }],
      output_config: { format: zodOutputFormat(o.schema), effort: o.effort },
    });
    if (res.stop_reason === "refusal") throw new Error("The model declined this extraction (stop_reason=refusal).");
    if (!res.parsed_output) throw new Error("The model returned no parseable structured output.");
    return { data: res.parsed_output, usage: summarizeUsage(res.usage), model: res.model };
  },

  async countTokens(system: string, text: string, model: string): Promise<number | null> {
    try {
      const r = await getClient().messages.countTokens({ model, system, messages: [{ role: "user", content: text }] });
      return r.input_tokens;
    } catch {
      return null;
    }
  },

  async checkModel(model: string) {
    const m = await getClient().models.retrieve(model);
    return { id: m.id, display_name: m.display_name };
  },

  reset() {
    client = null;
  },
};
