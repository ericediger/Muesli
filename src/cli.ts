import { Command } from "commander";
import { registerDoctor } from "./commands/doctor.js";
import { registerSync } from "./commands/sync.js";
import { registerFolders } from "./commands/folders.js";
import { registerSearch } from "./commands/search.js";
import { registerPeople } from "./commands/people.js";
import { registerNote } from "./commands/note.js";
import { registerExport } from "./commands/export.js";
import { registerAsk } from "./commands/ask.js";
import { registerProfile } from "./commands/profile.js";
import { registerWebhooks } from "./commands/webhooks.js";

const program = new Command();
program
  .name("granola")
  .description("API-level assistant for Granola: selective transcript export, scoped LLM queries, and per-person profiles.")
  .version("0.1.0")
  .showHelpAfterError();

registerDoctor(program);
registerSync(program);
registerFolders(program);
registerSearch(program);
registerPeople(program);
registerNote(program);
registerExport(program);
registerAsk(program);
registerProfile(program);
registerWebhooks(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const e = err as Error & { status?: number; body?: unknown };
  process.stderr.write(`error: ${e.message}\n`);
  if (e.body && process.env.DEBUG) process.stderr.write(JSON.stringify(e.body, null, 2) + "\n");
  process.exitCode = 1;
});
