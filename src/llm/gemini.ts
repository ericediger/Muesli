import {
  FinishReason,
  GoogleGenAI,
  ThinkingLevel,
  type Chat,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type GenerateContentResponseUsageMetadata,
} from "@google/genai";
import { z } from "zod";
import { config, requireGeminiKey, type Effort } from "../config.js";
import { log } from "../util.js";
import type { ChatOptions, CompleteOptions, ExtractOptions, ExtractResult, LlmProvider, ProviderChat, TurnResult, UsageSummary } from "./types.js";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = requireGeminiKey();
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/** Gemini 4 Hydrogen adds an xhigh thinking level; other Gemini models, Gemini 4 Carbon included, stop at high. */
export function supportsXHigh(model: string): boolean {
  return /^gemini-4-hydrogen/i.test(model.trim());
}

/** Map effort onto Gemini thinking: low / medium / high, plus xhigh where the model has it (max becomes the top level). */
export function toThinkingLevel(effort: Effort, model: string): ThinkingLevel {
  switch (effort) {
    case "low":
      return ThinkingLevel.LOW;
    case "medium":
      return ThinkingLevel.MEDIUM;
    case "high":
      return ThinkingLevel.HIGH;
    default:
      // ThinkingLevel.XHIGH arrives in @google/genai 3.x; the API already accepts the value.
      return supportsXHigh(model) ? ("XHIGH" as ThinkingLevel) : ThinkingLevel.HIGH;
  }
}

function usageFrom(u: GenerateContentResponseUsageMetadata | undefined): UsageSummary {
  const cached = u?.cachedContentTokenCount ?? 0;
  return {
    input_tokens: Math.max(0, (u?.promptTokenCount ?? 0) - cached),
    // Gemini bills thinking tokens as output.
    output_tokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
    cache_read_input_tokens: cached,
    cache_creation_input_tokens: 0,
  };
}

const BLOCKED: ReadonlySet<FinishReason> = new Set([
  FinishReason.SAFETY,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
  FinishReason.RECITATION,
]);

function baseConfig(system: string, model: string, effort: Effort, maxTokens: number): GenerateContentConfig {
  return {
    systemInstruction: system,
    maxOutputTokens: maxTokens,
    thinkingConfig: { thinkingLevel: toThinkingLevel(effort, model) },
  };
}

/** Drain a streamed response, forwarding text deltas and collecting usage and the finish reason. */
async function consume(
  streamPromise: Promise<AsyncGenerator<GenerateContentResponse>>,
  model: string,
  onText?: (delta: string) => void,
): Promise<TurnResult> {
  let text = "";
  let usage: GenerateContentResponseUsageMetadata | undefined;
  let finish: FinishReason | undefined;
  for await (const chunk of await streamPromise) {
    const blocked = chunk.promptFeedback?.blockReason;
    if (blocked) throw new Error(`Gemini blocked the prompt (${String(blocked)}).`);
    const t = chunk.text;
    if (t) {
      text += t;
      onText?.(t);
    }
    if (chunk.usageMetadata) usage = chunk.usageMetadata;
    const c = chunk.candidates?.[0];
    if (c?.finishReason) finish = c.finishReason;
  }
  if (finish && BLOCKED.has(finish)) throw new Error(`Gemini stopped the response (${String(finish)}).`);
  if (finish === FinishReason.MAX_TOKENS) log("\n[warning] the answer was cut off at max output tokens");
  return { text, usage: usageFrom(usage), model, stopReason: finish ? String(finish) : null };
}

class GeminiChat implements ProviderChat {
  readonly model: string;
  private chat: Chat | null = null;
  constructor(private readonly o: ChatOptions) {
    this.model = o.model;
  }
  async ask(question: string, onText?: (delta: string) => void): Promise<TurnResult> {
    const first = this.chat === null;
    if (!this.chat) {
      this.chat = getClient().chats.create({
        model: this.o.model,
        config: baseConfig(this.o.system, this.o.model, this.o.effort, this.o.maxTokens ?? 64000),
      });
    }
    // The corpus rides along with the first question and stays in the chat history for follow-ups.
    const message = first ? `<corpus>\n${this.o.corpusText}\n</corpus>\n\n${question}` : question;
    return consume(this.chat.sendMessageStream({ message }), this.o.model, onText);
  }
}

/** Gemini's responseJsonSchema accepts a JSON-Schema subset; strip keys it rejects. */
function toGeminiJsonSchema(schema: z.ZodType): unknown {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "$schema" || k === "additionalProperties" || k === "$id") continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(js);
}

export const geminiProvider: LlmProvider = {
  id: "gemini",

  configured: () => Boolean(config.geminiApiKey),

  async complete(o: CompleteOptions): Promise<TurnResult> {
    const contents: Content[] = [{ role: "user", parts: o.blocks.map((b) => ({ text: b.text })) }];
    return consume(
      getClient().models.generateContentStream({
        model: o.model,
        contents,
        config: baseConfig(o.system, o.model, o.effort, o.maxTokens ?? 64000),
      }),
      o.model,
      o.onText,
    );
  },

  createChat(o: ChatOptions): ProviderChat {
    return new GeminiChat(o);
  },

  async extractStructured<S extends z.ZodType>(o: ExtractOptions<S>): Promise<ExtractResult<z.infer<S>>> {
    const res = await getClient().models.generateContent({
      model: o.model,
      contents: [{ role: "user", parts: [{ text: o.user }] }],
      config: {
        ...baseConfig(o.system, o.model, o.effort, o.maxTokens ?? 16000),
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiJsonSchema(o.schema),
      },
    });
    const blocked = res.promptFeedback?.blockReason;
    if (blocked) throw new Error(`Gemini blocked the extraction prompt (${String(blocked)}).`);
    const finish = res.candidates?.[0]?.finishReason;
    if (finish && BLOCKED.has(finish)) throw new Error(`Gemini stopped the extraction (${String(finish)}).`);
    const text = res.text;
    if (!text) throw new Error("Gemini returned no structured output.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned output that is not valid JSON.");
    }
    const data = o.schema.parse(parsed) as z.infer<S>;
    return { data, usage: usageFrom(res.usageMetadata), model: o.model };
  },

  async countTokens(system: string, text: string, model: string): Promise<number | null> {
    try {
      const r = await getClient().models.countTokens({
        model,
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${text}` }] }],
      });
      return r.totalTokens ?? null;
    } catch {
      return null;
    }
  },

  async checkModel(model: string) {
    const m = await getClient().models.get({ model });
    return { id: (m.name ?? model).replace(/^models\//, ""), display_name: m.displayName ?? model };
  },

  reset() {
    client = null;
  },
};
