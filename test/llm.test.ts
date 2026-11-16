import { test } from "node:test";
import assert from "node:assert/strict";
import { MODEL_CHOICES } from "../src/config.js";
import { providerFor, providerIdFor } from "../src/llm/index.js";
import { toThinkingLevel } from "../src/llm/gemini.js";
import { ThinkingLevel } from "@google/genai";

test("model ids route to the right provider", () => {
  assert.equal(providerIdFor("claude-fable-5-2"), "anthropic");
  assert.equal(providerIdFor("claude-opus-5-5"), "anthropic");
  assert.equal(providerIdFor("gemini-4-hydrogen"), "gemini");
  assert.equal(providerIdFor("gemini-4-carbon"), "gemini");
  assert.equal(providerIdFor(" Gemini-3.1-pro-preview "), "gemini");
  assert.equal(providerIdFor("gpt-6-astra"), "openai");
  assert.equal(providerIdFor("gpt-6.1-terra"), "openai");
  assert.equal(providerIdFor("o5-mini"), "openai");
  assert.equal(providerFor("gemini-4-hydrogen").id, "gemini");
  assert.equal(providerFor("gpt-6-astra").id, "openai");
  assert.equal(providerFor("claude-opus-5-5").id, "anthropic");
});

test("every picker model routes to the provider it is listed under", () => {
  assert.deepEqual(
    MODEL_CHOICES.map((c) => c.id),
    ["claude-fable-5-2", "gpt-6-astra", "claude-opus-5-5", "gemini-4-carbon", "claude-sonnet-5-5", "gemini-4-hydrogen", "gpt-6.1-terra"],
  );
  for (const c of MODEL_CHOICES) assert.equal(providerIdFor(c.id), c.provider, c.id);
});

test("effort maps onto Gemini thinking levels", () => {
  assert.equal(toThinkingLevel("low", "gemini-4-hydrogen"), ThinkingLevel.LOW);
  assert.equal(toThinkingLevel("medium", "gemini-4-hydrogen"), ThinkingLevel.MEDIUM);
  assert.equal(toThinkingLevel("high", "gemini-4-hydrogen"), ThinkingLevel.HIGH);
  assert.equal(toThinkingLevel("xhigh", "gemini-4-hydrogen"), "XHIGH");
  assert.equal(toThinkingLevel("max", "gemini-4-hydrogen"), "XHIGH");
  // Models without xhigh stop at high.
  assert.equal(toThinkingLevel("high", "gemini-4-carbon"), ThinkingLevel.HIGH);
  assert.equal(toThinkingLevel("xhigh", "gemini-4-carbon"), ThinkingLevel.HIGH);
  assert.equal(toThinkingLevel("max", "gemini-4-carbon"), ThinkingLevel.HIGH);
  assert.equal(toThinkingLevel("xhigh", "gemini-3.8-flash"), ThinkingLevel.HIGH);
  assert.equal(toThinkingLevel("max", "gemini-3.8-flash"), ThinkingLevel.HIGH);
});
