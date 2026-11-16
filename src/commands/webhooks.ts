import type { Command } from "commander";
import { config, requireGranolaKey } from "../config.js";
import { GranolaClient } from "../granola/client.js";
import type { WebhookEvent, WebhookScope } from "../granola/types.js";
import { table } from "../util.js";

export function registerWebhooks(program: Command): void {
  const wh = program.command("webhooks").description("Manage Granola webhook endpoints (note.generated / note.edited / note.access_granted)");
  const client = () => new GranolaClient({ apiKey: requireGranolaKey(), baseUrl: config.granolaBaseUrl });

  wh.command("list")
    .description("List webhook endpoints")
    .action(async () => {
      const eps = await client().listWebhookEndpoints();
      if (!eps.length) return console.log("No webhook endpoints.");
      console.log(
        table(
          eps.map((e) => ({ id: e.id, url: e.url, events: e.events.join(","), scopes: e.scopes.join(","), folders: e.folder_ids.join(","), enabled: String(e.enabled) })),
          ["id", "url", "events", "scopes", "folders", "enabled"],
        ),
      );
    });

  wh.command("create")
    .description("Register an HTTPS endpoint; prints the one-time signing secret")
    .requiredOption("--url <https-url>", "publicly reachable HTTPS URL")
    .option("--scopes <list>", "personal,public,workspace", "personal")
    .option("--events <list>", "note.generated,note.edited,note.access_granted (default: all)")
    .option("--folders <list>", "restrict to these folder IDs")
    .action(async (o: { url: string; scopes: string; events?: string; folders?: string }) => {
      const out = await client().createWebhookEndpoint({
        url: o.url,
        scopes: o.scopes.split(",").map((s) => s.trim()) as WebhookScope[],
        events: o.events ? (o.events.split(",").map((s) => s.trim()) as WebhookEvent[]) : undefined,
        folder_ids: o.folders ? o.folders.split(",").map((s) => s.trim()) : undefined,
      });
      console.log(JSON.stringify(out, null, 2));
      console.log("\nStore signing_secret now; Granola never shows it again.");
    });

  wh.command("pause <id>").action(async (id: string) => console.log(JSON.stringify(await client().updateWebhookEndpoint(id, { enabled: false }), null, 2)));
  wh.command("resume <id>").action(async (id: string) => console.log(JSON.stringify(await client().updateWebhookEndpoint(id, { enabled: true }), null, 2)));
  wh.command("delete <id>").action(async (id: string) => {
    await client().deleteWebhookEndpoint(id);
    console.log(`Deleted ${id}`);
  });
}
