import { anthropicProvider } from "./anthropic.js";
import { geminiProvider } from "./gemini.js";
import { openaiProvider } from "./openai.js";
import type { LlmProvider, ProviderId } from "./types.js";

export * from "./types.js";

/** Model ids starting with "gemini" go to Google, "gpt-" (or o-series) to OpenAI; everything else to Anthropic. */
export function providerIdFor(model: string): ProviderId {
  const m = model.trim();
  if (/^gemini/i.test(m)) return "gemini";
  if (/^(gpt-|chatgpt-|o\d)/i.test(m)) return "openai";
  return "anthropic";
}

const byId: Record<ProviderId, LlmProvider> = { anthropic: anthropicProvider, openai: openaiProvider, gemini: geminiProvider };

export function providerFor(model: string): LlmProvider {
  return byId[providerIdFor(model)];
}

export const providers: LlmProvider[] = [anthropicProvider, openaiProvider, geminiProvider];

export function resetLlmClients(): void {
  for (const p of providers) p.reset();
}
