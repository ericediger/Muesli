import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
// src/config.ts -> project root is one level up (dist/config.js -> also one level up)
export const PROJECT_ROOT = path.resolve(here, "..");
export const ENV_PATH = path.join(PROJECT_ROOT, ".env");

// Variables set in the shell before start take precedence over .env, here and on reload.
const SHELL_KEYS = new Set(Object.keys(process.env));
dotenv.config({ path: ENV_PATH, quiet: true });

type EnvSnapshot = { stamp: string; values: Record<string, string> };

function envStamp(): string {
  try {
    const st = fs.statSync(ENV_PATH);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return "missing";
  }
}

function readEnvSnapshot(): EnvSnapshot {
  const stamp = envStamp();
  const values = stamp === "missing" ? {} : dotenv.parse(fs.readFileSync(ENV_PATH));
  return { stamp, values };
}

let envSnapshot = readEnvSnapshot();

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const EFFORT_LEVELS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

function effortFromEnv(name: string, fallback: Effort): Effort {
  const v = (process.env[name] ?? fallback).toLowerCase();
  return (EFFORT_LEVELS as string[]).includes(v) ? (v as Effort) : fallback;
}

/**
 * The models offered in the GUI pickers, in two groups, each with the effort it is meant to run at
 * (picking one in the GUI sets that effort). Any other id still works when typed on the CLI.
 */
export const MODEL_CHOICES: readonly { id: string; label: string; provider: "anthropic" | "openai" | "gemini"; effort: Effort; group: "strongest" | "faster"; note: string }[] = [
  { id: "claude-fable-5-2", label: "Claude Fable 5.2", provider: "anthropic", effort: "max", group: "strongest", note: "$8 / $40 per MTok" },
  { id: "gpt-6-astra", label: "GPT-6 Astra", provider: "openai", effort: "max", group: "strongest", note: "$10 / $50 per MTok" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", provider: "anthropic", effort: "max", group: "strongest", note: "$4 / $20 per MTok" },
  { id: "gemini-4-carbon", label: "Gemini 4 Carbon", provider: "gemini", effort: "high", group: "strongest", note: "$4 / $20 per MTok ($2 / $10 until Nov 30); high is its top level" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "anthropic", effort: "max", group: "faster", note: "$2 / $10 per MTok" },
  { id: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen", provider: "gemini", effort: "xhigh", group: "faster", note: "$1.50 / $7.50 per MTok; xhigh is its top level" },
  { id: "gpt-6.1-terra", label: "GPT-6.1 Terra", provider: "openai", effort: "max", group: "faster", note: "$1 / $5 per MTok" },
];

/** Defaults for fresh installs: Opus 5.5 for answers and synthesis and (at medium effort) for extraction. */
export const DEFAULT_MODEL = "claude-opus-5-5";
export const DEFAULT_EXTRACT_MODEL = "claude-opus-5-5";
export const DEFAULT_EFFORT: Effort = "high";
export const DEFAULT_EXTRACT_EFFORT: Effort = "medium";

function compute() {
  const dataDir = path.resolve(PROJECT_ROOT, process.env.DATA_DIR ?? "data");
  return {
    granolaApiKey: process.env.GRANOLA_API_KEY ?? "",
    granolaBaseUrl: process.env.GRANOLA_BASE_URL ?? "https://public-api.granola.ai",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    llmModel: process.env.LLM_MODEL ?? DEFAULT_MODEL,
    llmExtractModel: process.env.LLM_EXTRACT_MODEL ?? DEFAULT_EXTRACT_MODEL,
    llmEffort: effortFromEnv("LLM_EFFORT", DEFAULT_EFFORT),
    llmExtractEffort: effortFromEnv("LLM_EXTRACT_EFFORT", DEFAULT_EXTRACT_EFFORT),
    dataDir,
    /** Drop folder for transcripts copied out of Granola (see `import`). */
    inboxDir: process.env.INBOX_DIR ? path.resolve(PROJECT_ROOT, process.env.INBOX_DIR) : path.join(dataDir, "inbox"),
    meEmail: process.env.ME_EMAIL ?? "",
    meName: process.env.ME_NAME ?? "",
  };
}

export const config = compute();

/** Re-read process.env into `config` (after saving settings or changing env in-process). */
export function reloadConfig(): void {
  Object.assign(config, compute());
}

/**
 * Pick up hand edits to .env while a long-running process (the GUI server) is up.
 * Returns true when the file changed, so the caller can drop clients built with an old key.
 */
export function reloadEnvIfChanged(): boolean {
  if (envStamp() === envSnapshot.stamp) return false;
  const next = readEnvSnapshot();
  for (const k of Object.keys(envSnapshot.values)) {
    if (!(k in next.values) && !SHELL_KEYS.has(k)) delete process.env[k];
  }
  for (const [k, v] of Object.entries(next.values)) {
    if (!SHELL_KEYS.has(k)) process.env[k] = v;
  }
  envSnapshot = next;
  reloadConfig();
  return true;
}

export const SETTINGS_KEYS = ["GRANOLA_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "LLM_MODEL", "LLM_EXTRACT_MODEL", "LLM_EFFORT", "LLM_EXTRACT_EFFORT", "ME_NAME", "ME_EMAIL"] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

function quoteEnvValue(v: string): string {
  return /[\s#"'`$\\]/.test(v) ? JSON.stringify(v) : v;
}

/**
 * Update keys in the project .env file (creating it if needed), apply them to
 * process.env, and reload `config`. A null or empty value removes the key.
 */
export function saveEnvValues(updates: Partial<Record<SettingsKey, string | null>>): void {
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const lines = existing.split(/\r?\n/);
  for (const [k, raw] of Object.entries(updates)) {
    const v = raw === null || raw === undefined ? "" : String(raw).trim();
    const re = new RegExp(`^\\s*(export\\s+)?${k}\\s*=`);
    const idx = lines.findIndex((l) => re.test(l));
    if (!v) {
      if (idx >= 0) lines.splice(idx, 1);
      delete process.env[k];
      continue;
    }
    const line = `${k}=${quoteEnvValue(v)}`;
    if (idx >= 0) lines[idx] = line;
    else lines.push(line);
    process.env[k] = v;
  }
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n", { mode: 0o600 });
  envSnapshot = readEnvSnapshot();
  reloadConfig();
}

export function maskSecret(k: string): string {
  if (!k) return "";
  if (k.length <= 12) return "•".repeat(k.length);
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}

export function requireGranolaKey(): string {
  if (!config.granolaApiKey) {
    throw new Error(
      "GRANOLA_API_KEY is not set. Create a personal key in Granola (Settings -> Connectors -> API keys) and put it in .env (see .env.example).",
    );
  }
  return config.granolaApiKey;
}

export function requireAnthropicKey(): void {
  if (!config.anthropicApiKey && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("ANTHROPIC_API_KEY is not set. Put it in .env (see .env.example) or on the Settings page.");
  }
}

export function requireOpenAIKey(): string {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not set. Put it in .env (see .env.example) or on the Settings page.");
  }
  return config.openaiApiKey;
}

export function requireGeminiKey(): string {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not set. Put it in .env (see .env.example) or on the Settings page.");
  }
  return config.geminiApiKey;
}
