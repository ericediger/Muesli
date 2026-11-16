import type { Command } from "commander";
import { runDoctor } from "../services/doctor.js";

const PROVIDER_LABEL = { anthropic: "Claude", openai: "OpenAI", gemini: "Gemini" } as const;

export function registerDoctor(program: Command): void {
  program
    .command("doctor")
    .description("Check configuration, Granola API access, and the LLM connection")
    .action(async () => {
      const r = await runDoctor();
      console.log("Configuration");
      console.log(`  GRANOLA_API_KEY    ${r.config.granolaKey || "(not set)"}`);
      console.log(`  ANTHROPIC_API_KEY  ${r.config.anthropicKey || "(not set)"}`);
      console.log(`  OPENAI_API_KEY     ${r.config.openaiKey || "(not set)"}`);
      console.log(`  GEMINI_API_KEY     ${r.config.geminiKey || "(not set)"}`);
      console.log(`  LLM_MODEL          ${r.config.model} (effort ${r.config.effort}); extraction ${r.config.extractModel} (effort ${r.config.extractEffort})`);
      console.log(`  DATA_DIR           ${r.config.dataDir}`);
      console.log(`  Archive            ${r.archive.notes} notes (${r.archive.withTranscripts} with transcripts), last sync ${r.archive.lastSync ?? "never"}, me=${r.archive.me.name ?? "?"} <${r.archive.me.email ?? "?"}>`);
      console.log("");
      console.log(`Granola: ${r.granola.ok ? "OK. " : "FAILED. "}${r.granola.message}`);
      for (const p of r.providers) {
        const used = p.usedFor.length ? ` (used for ${p.usedFor.join(", ")})` : " (not used by current settings)";
        console.log(`${PROVIDER_LABEL[p.id]}: ${p.ok ? "OK. " : p.configured ? "FAILED. " : ""}${p.message}${used}`);
      }
      console.log("");
      console.log(r.ok ? "All checks passed." : "Some checks failed; fix the items above and re-run.");
      if (!r.ok) process.exitCode = 1;
    });
}
