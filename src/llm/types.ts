import type { z } from "zod";
import type { Effort } from "../config.js";

export type ProviderId = "anthropic" | "openai" | "gemini";

export interface UsageSummary {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface TurnResult {
  text: string;
  usage: UsageSummary;
  model: string;
  stopReason: string | null;
}

/** A text block for a one-shot request; `cache` marks a stable prefix worth caching where the provider supports it. */
export interface TextBlock {
  text: string;
  cache?: boolean;
}

export interface CompleteOptions {
  system: string;
  blocks: TextBlock[];
  model: string;
  effort: Effort;
  maxTokens?: number;
  onText?: (delta: string) => void;
}

export interface ChatOptions {
  system: string;
  /** Large stable context sent with the first question and kept for follow-ups. */
  corpusText: string;
  model: string;
  effort: Effort;
  maxTokens?: number;
}

/** A multi-turn conversation over one corpus. Providers manage their own history and caching. */
export interface ProviderChat {
  readonly model: string;
  ask(question: string, onText?: (delta: string) => void): Promise<TurnResult>;
}

export interface ExtractOptions<S extends z.ZodType> {
  schema: S;
  system: string;
  user: string;
  model: string;
  effort: Effort;
  maxTokens?: number;
}

export interface ExtractResult<T> {
  data: T;
  usage: UsageSummary;
  model: string;
}

export interface LlmProvider {
  readonly id: ProviderId;
  /** Whether credentials for this provider are configured. */
  configured(): boolean;
  complete(opts: CompleteOptions): Promise<TurnResult>;
  createChat(opts: ChatOptions): ProviderChat;
  extractStructured<S extends z.ZodType>(opts: ExtractOptions<S>): Promise<ExtractResult<z.infer<S>>>;
  countTokens(system: string, text: string, model: string): Promise<number | null>;
  checkModel(model: string): Promise<{ id: string; display_name: string }>;
  /** Drop cached SDK clients so a changed key takes effect. */
  reset(): void;
}

export function emptyUsage(): UsageSummary {
  return { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
}

export function addUsage(total: UsageSummary, u: UsageSummary): void {
  total.input_tokens += u.input_tokens;
  total.output_tokens += u.output_tokens;
  total.cache_read_input_tokens += u.cache_read_input_tokens;
  total.cache_creation_input_tokens += u.cache_creation_input_tokens;
}

export function formatUsage(u: UsageSummary, model: string): string {
  return `[${model}] in=${u.input_tokens} cached=${u.cache_read_input_tokens} cache_write=${u.cache_creation_input_tokens} out=${u.output_tokens}`;
}
