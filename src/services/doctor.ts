import { MODEL_CHOICES, config, maskSecret } from "../config.js";
import { GranolaClient } from "../granola/client.js";
import { loadIndex, paths } from "../store/store.js";
import { providerFor, providers, type ProviderId } from "../llm/index.js";

export interface ProviderCheck {
  id: ProviderId;
  configured: boolean;
  ok: boolean;
  message: string;
  /** Models from the current settings that route to this provider. */
  usedFor: string[];
}

export interface DoctorReport {
  ok: boolean;
  config: {
    granolaKey: string;
    anthropicKey: string;
    openaiKey: string;
    geminiKey: string;
    model: string;
    extractModel: string;
    effort: string;
    extractEffort: string;
    dataDir: string;
    meName: string;
    meEmail: string;
  };
  archive: { notes: number; withTranscripts: number; lastSync: string | null; me: { name: string | null; email: string | null } };
  granola: { ok: boolean; message: string };
  providers: ProviderCheck[];
}

const KEY_NAME: Record<ProviderId, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" };

export async function runDoctor(): Promise<DoctorReport> {
  const idx = loadIndex();
  const report: DoctorReport = {
    ok: true,
    config: {
      granolaKey: maskSecret(config.granolaApiKey),
      anthropicKey: maskSecret(config.anthropicApiKey),
      openaiKey: maskSecret(config.openaiApiKey),
      geminiKey: maskSecret(config.geminiApiKey),
      model: config.llmModel,
      extractModel: config.llmExtractModel,
      effort: config.llmEffort,
      extractEffort: config.llmExtractEffort,
      dataDir: paths.root(),
      meName: config.meName,
      meEmail: config.meEmail,
    },
    archive: {
      notes: idx.notes.length,
      withTranscripts: idx.notes.filter((n) => n.has_transcript).length,
      lastSync: idx.last_sync_at,
      me: idx.me,
    },
    granola: { ok: false, message: "" },
    providers: [],
  };

  if (!config.granolaApiKey) {
    report.granola.message = "No API key. Create one in the Granola app: Settings → Connectors → API keys.";
  } else {
    try {
      const client = new GranolaClient({ apiKey: config.granolaApiKey, baseUrl: config.granolaBaseUrl });
      const [note] = await client.listAllNotes({ page_size: 1 }, 1);
      const folders = await client.listFolders();
      report.granola.ok = true;
      report.granola.message = note
        ? `Connected. Newest note "${note.title ?? "(untitled)"}" (${note.created_at.slice(0, 10)}) owned by ${note.owner.email}; ${folders.length} folder(s).`
        : `Connected, but no notes are visible to this key; ${folders.length} folder(s).`;
    } catch (err) {
      report.granola.message = (err as Error).message;
    }
  }

  const usedModels = [...new Set([config.llmModel, config.llmExtractModel])];
  for (const p of providers) {
    const usedFor = usedModels.filter((m) => providerFor(m).id === p.id);
    const check: ProviderCheck = { id: p.id, configured: p.configured(), ok: false, message: "", usedFor };
    if (!check.configured) {
      check.message = `No ${KEY_NAME[p.id]} set.`;
    } else {
      try {
        // Verify with a model this provider will actually be asked to run, else its first picker model.
        const probe = usedFor[0] ?? MODEL_CHOICES.find((c) => c.provider === p.id)?.id ?? config.llmModel;
        const m = await p.checkModel(probe);
        check.ok = true;
        check.message = `Connected. ${m.display_name} (${m.id}).`;
      } catch (err) {
        check.message = (err as Error).message;
      }
    }
    report.providers.push(check);
  }

  const needed = report.providers.filter((p) => p.usedFor.length > 0);
  report.ok = report.granola.ok && needed.length > 0 && needed.every((p) => p.ok);
  return report;
}
