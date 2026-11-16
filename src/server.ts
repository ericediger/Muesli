import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT, MODEL_CHOICES, config, maskSecret, reloadConfig, reloadEnvIfChanged, saveEnvValues, EFFORT_LEVELS, type Effort, type SettingsKey } from "./config.js";
import { resetLlmClients } from "./llm/index.js";
import { runDoctor } from "./services/doctor.js";
import { syncArchive } from "./services/sync.js";
import { exportNotes, type ExportFormat } from "./services/export.js";
import { ASK_CONFIRM_TOKENS, askTurn, createAskSession, saveConversation, type AskSession } from "./services/ask.js";
import { buildProfile, listProfiles, selectProfileMeetings } from "./services/profile.js";
import { loadIndex, loadNote, hasNote, normalizeFields, paths, searchIndex } from "./store/store.js";
import { collectPeople } from "./people/people.js";
import { noteToMarkdown, normalizeContentMode, themNameFor } from "./corpus/format.js";
import { GranolaClient } from "./granola/client.js";
import { parseSince } from "./util.js";
import type { SelectOptions } from "./commands/select.js";

// ---- CLI args ----------------------------------------------------------------
const args = process.argv.slice(2);
const argValue = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
if (argValue("--data-dir")) {
  process.env.DATA_DIR = argValue("--data-dir");
  reloadConfig();
}
const PORT = Number(argValue("--port") ?? process.env.PORT ?? 4747);
const HOST = "127.0.0.1";
const WEB_DIR = path.join(PROJECT_ROOT, "web");

// ---- helpers -----------------------------------------------------------------
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

/** Newline-delimited JSON stream for long-running operations. */
function ndjson(res: http.ServerResponse): { send: (obj: unknown) => void; end: () => void } {
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no",
  });
  return {
    send: (obj) => res.write(JSON.stringify(obj) + "\n"),
    end: () => res.end(),
  };
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function serveStatic(res: http.ServerResponse, urlPath: string): void {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const file = path.resolve(WEB_DIR, "." + rel);
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}

/** Only allow downloads from inside the data directory. */
function safeDataFile(p: string): string {
  const abs = path.resolve(p);
  const root = path.resolve(paths.root()) + path.sep;
  if (!abs.startsWith(root) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) throw new HttpError(404, "File not found");
  return abs;
}

function selectionFromBody(b: Record<string, unknown>): SelectOptions {
  const s = (k: string) => (typeof b[k] === "string" && (b[k] as string).trim() ? (b[k] as string).trim() : undefined);
  return {
    ids: Array.isArray(b.ids) ? (b.ids as string[]).join(",") : s("ids"),
    search: s("search"),
    in: normalizeFields(b.fields),
    deep: Boolean(b.deep),
    person: s("person"),
    email: s("email"),
    since: s("since"),
    until: s("until"),
    folder: s("folder"),
    limit: s("limit"),
  };
}

function effortOrUndefined(v: unknown): Effort | undefined {
  return typeof v === "string" && (EFFORT_LEVELS as string[]).includes(v) ? (v as Effort) : undefined;
}

// ---- ask sessions (in memory) --------------------------------------------------
const askSessions = new Map<string, AskSession>();
function rememberSession(s: AskSession): void {
  askSessions.set(s.id, s);
  if (askSessions.size > 30) {
    const oldest = [...askSessions.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    askSessions.delete(oldest.id);
  }
}

// ---- routes -------------------------------------------------------------------
async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const route = `${req.method} ${url.pathname}`;
  // Hand edits to .env apply without a restart.
  if (reloadEnvIfChanged()) resetLlmClients();

  if (route === "GET /api/status") {
    const idx = loadIndex();
    return json(res, 200, {
      keys: { granola: Boolean(config.granolaApiKey), anthropic: Boolean(config.anthropicApiKey || process.env.ANTHROPIC_AUTH_TOKEN), openai: Boolean(config.openaiApiKey), gemini: Boolean(config.geminiApiKey) },
      masked: { granola: maskSecret(config.granolaApiKey), anthropic: maskSecret(config.anthropicApiKey), openai: maskSecret(config.openaiApiKey), gemini: maskSecret(config.geminiApiKey) },
      modelChoices: MODEL_CHOICES,
      model: config.llmModel,
      extractModel: config.llmExtractModel,
      effort: config.llmEffort,
      extractEffort: config.llmExtractEffort,
      meName: config.meName,
      meEmail: config.meEmail,
      dataDir: paths.root(),
      archive: {
        notes: idx.notes.length,
        withTranscripts: idx.notes.filter((n) => n.has_transcript).length,
        lastSync: idx.last_sync_at,
        me: idx.me,
        newest: idx.notes[0] ? { title: idx.notes[0].title, created_at: idx.notes[0].created_at } : null,
        oldest: idx.notes.length ? { title: idx.notes[idx.notes.length - 1].title, created_at: idx.notes[idx.notes.length - 1].created_at } : null,
      },
      effortLevels: EFFORT_LEVELS,
    });
  }

  if (route === "POST /api/settings") {
    const body = await readJson<Partial<Record<SettingsKey, string | null>>>(req);
    const allowed: SettingsKey[] = ["GRANOLA_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "LLM_MODEL", "LLM_EXTRACT_MODEL", "LLM_EFFORT", "LLM_EXTRACT_EFFORT", "ME_NAME", "ME_EMAIL"];
    const updates: Partial<Record<SettingsKey, string | null>> = {};
    for (const k of allowed) if (k in body) updates[k] = body[k] ?? null;
    for (const k of ["LLM_EFFORT", "LLM_EXTRACT_EFFORT"] as const) {
      if (updates[k] && !(EFFORT_LEVELS as string[]).includes(String(updates[k]))) throw new HttpError(400, `Invalid effort level for ${k}`);
    }
    if (updates.GRANOLA_API_KEY && !/^grn_/.test(String(updates.GRANOLA_API_KEY))) throw new HttpError(400, "Granola keys start with grn_");
    if (updates.GEMINI_API_KEY && String(updates.GEMINI_API_KEY).length < 20) throw new HttpError(400, "That does not look like a Gemini API key");
    if (updates.OPENAI_API_KEY && !/^sk-/.test(String(updates.OPENAI_API_KEY))) throw new HttpError(400, "OpenAI keys start with sk-");
    saveEnvValues(updates);
    resetLlmClients();
    return json(res, 200, { ok: true, masked: { granola: maskSecret(config.granolaApiKey), anthropic: maskSecret(config.anthropicApiKey), openai: maskSecret(config.openaiApiKey), gemini: maskSecret(config.geminiApiKey) } });
  }

  if (route === "POST /api/doctor") return json(res, 200, await runDoctor());

  if (route === "POST /api/sync") {
    const body = await readJson<{ since?: string; until?: string; folder?: string; full?: boolean; refresh?: boolean; limit?: number }>(req);
    const out = ndjson(res);
    try {
      const r = await syncArchive({ ...body, limit: body.limit ? Number(body.limit) : undefined }, (msg) => out.send({ type: "log", message: msg }));
      out.send({ type: "done", result: r });
    } catch (err) {
      out.send({ type: "error", message: (err as Error).message });
    }
    return out.end();
  }

  if (route === "GET /api/folders") {
    if (!config.granolaApiKey) throw new HttpError(400, "Granola API key is not set");
    const client = new GranolaClient({ apiKey: config.granolaApiKey, baseUrl: config.granolaBaseUrl });
    const folders = await client.listFolders();
    const idx = loadIndex();
    const counts = new Map<string, number>();
    for (const n of idx.notes) for (const id of n.folder_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    return json(res, 200, { folders: folders.map((f) => ({ ...f, stored_notes: counts.get(f.id) ?? 0 })) });
  }

  if (route === "GET /api/search") {
    const q = url.searchParams;
    const idx = loadIndex();
    const person = q.get("person")?.trim();
    const all = searchIndex(idx, {
      q: q.get("search")?.trim() || undefined,
      fields: normalizeFields(q.get("fields")),
      deep: q.get("deep") === "1",
      person: person ? { name: person, email: q.get("email")?.trim() || undefined } : undefined,
      since: parseSince(q.get("since")?.trim() || undefined),
      until: q.get("until")?.trim() ? parseSince(q.get("until")!.trim()) : undefined,
      folder: q.get("folder")?.trim() || undefined,
      ids: q.get("ids") ? q.get("ids")!.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    });
    const offset = Math.max(0, Number(q.get("offset") ?? 0) || 0);
    const limit = q.get("all") === "1" ? all.length : Math.max(1, Number(q.get("limit") ?? 100) || 100);
    const oldest = idx.notes.length ? idx.notes[idx.notes.length - 1].created_at : null;
    const newest = idx.notes.length ? idx.notes[0].created_at : null;
    return json(res, 200, {
      me: idx.me,
      total: idx.notes.length,
      matches: all.length,
      offset,
      range: { oldest, newest },
      entries: all.slice(offset, offset + limit),
    });
  }

  if (route === "GET /api/people") {
    const idx = loadIndex();
    return json(res, 200, { people: collectPeople(idx.notes, idx.me) });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/note/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/note/".length));
    if (!/^not_[A-Za-z0-9]+$/.test(id)) throw new HttpError(400, "Invalid note id");
    if (!hasNote(id)) throw new HttpError(404, "Note is not in the local archive");
    const note = loadNote(id);
    const idx = loadIndex();
    if (url.searchParams.get("format") === "json") return json(res, 200, note);
    return json(res, 200, { id, title: note.title, web_url: note.web_url, markdown: noteToMarkdown(note, { meName: idx.me.name ?? "Me", themName: themNameFor(note) }) });
  }

  if (route === "POST /api/export") {
    const body = await readJson<Record<string, unknown>>(req);
    const r = exportNotes({
      ...selectionFromBody(body),
      format: (body.format as ExportFormat) ?? "md",
      content: normalizeContentMode(body.content),
      bundle: Boolean(body.bundle),
      timestamps: body.timestamps !== false,
      all: Boolean(body.all),
    });
    return json(res, 200, { ...r, files: r.files.map((f) => ({ path: f, name: path.basename(f) })) });
  }

  if (route === "GET /api/file") {
    const file = safeDataFile(url.searchParams.get("path") ?? "");
    const download = url.searchParams.get("download") === "1";
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
      ...(download ? { "Content-Disposition": `attachment; filename="${path.basename(file)}"` } : {}),
    });
    fs.createReadStream(file).pipe(res);
    return;
  }

  if (route === "POST /api/ask/preview") {
    const body = await readJson<Record<string, unknown>>(req);
    const s = createAskSession(selectionFromBody(body), {
      content: normalizeContentMode(body.content, "transcript"),
      includeSummary: body.summary !== false,
      includePrivateNotes: body.private !== false,
    });
    return json(res, 200, {
      selection: s.selection,
      content: s.content,
      tokens: s.corpusTokens,
      notesWithoutTranscript: s.notesWithoutTranscript,
      confirmAbove: ASK_CONFIRM_TOKENS,
      entries: s.entries.map((e) => ({ id: e.id, title: e.title, created_at: e.created_at, word_count: e.word_count })),
    });
  }

  if (route === "POST /api/ask") {
    const body = await readJson<Record<string, unknown>>(req);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) throw new HttpError(400, "Question is required");
    let session = typeof body.sessionId === "string" ? askSessions.get(body.sessionId) : undefined;
    if (!session) {
      session = createAskSession(selectionFromBody(body), {
        model: typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined,
        effort: effortOrUndefined(body.effort),
        content: normalizeContentMode(body.content, "transcript"),
        includeSummary: body.summary !== false,
        includePrivateNotes: body.private !== false,
      });
      rememberSession(session);
    }
    const out = ndjson(res);
    out.send({
      type: "session",
      sessionId: session.id,
      selection: session.selection,
      content: session.content,
      tokens: session.corpusTokens,
      notes: session.entries.length,
      model: session.model,
      effort: session.effort,
    });
    try {
      const r = await askTurn(session, question, (t) => out.send({ type: "text", text: t }));
      const saved = saveConversation(session);
      out.send({ type: "done", usage: r.usage, model: r.model, saved });
    } catch (err) {
      out.send({ type: "error", message: (err as Error).message });
    }
    return out.end();
  }

  if (route === "POST /api/profile/preview") {
    const body = await readJson<Record<string, unknown>>(req);
    if (typeof body.name !== "string" || !body.name.trim()) throw new HttpError(400, "Name is required");
    const sel = selectProfileMeetings({
      name: body.name.trim(),
      email: typeof body.email === "string" ? body.email.trim() || undefined : undefined,
      since: typeof body.since === "string" ? body.since.trim() || undefined : undefined,
      until: typeof body.until === "string" ? body.until.trim() || undefined : undefined,
      ids: Array.isArray(body.ids) ? (body.ids as unknown[]).filter((x): x is string => typeof x === "string") : undefined,
      plusAuto: Boolean(body.plusAuto),
      content: normalizeContentMode(body.content, "transcript"),
      includeGroup: body.includeGroup !== false,
    });
    return json(res, 200, {
      source: sel.source,
      content: sel.content,
      explicit: sel.explicit,
      missing: sel.missing,
      candidates: sel.candidates,
      skipped: sel.skipped,
      me: sel.index.me,
      selected: sel.selected.map((s) => ({ id: s.entry.id, title: s.entry.title, created_at: s.entry.created_at, kind: s.kind, word_count: s.entry.word_count, me_word_share: s.entry.me_word_share })),
    });
  }

  if (route === "POST /api/profile") {
    const body = await readJson<Record<string, unknown>>(req);
    if (typeof body.name !== "string" || !body.name.trim()) throw new HttpError(400, "Name is required");
    const out = ndjson(res);
    try {
      const r = await buildProfile(
        {
          name: body.name.trim(),
          email: typeof body.email === "string" ? body.email.trim() || undefined : undefined,
          since: typeof body.since === "string" ? body.since.trim() || undefined : undefined,
          until: typeof body.until === "string" ? body.until.trim() || undefined : undefined,
          ids: Array.isArray(body.ids) ? (body.ids as unknown[]).filter((x): x is string => typeof x === "string") : undefined,
          plusAuto: Boolean(body.plusAuto),
          content: normalizeContentMode(body.content, "transcript"),
          includeGroup: body.includeGroup !== false,
          corpus: body.corpus !== false,
          refresh: Boolean(body.refresh),
          model: typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined,
          extractModel: typeof body.extractModel === "string" && body.extractModel.trim() ? body.extractModel.trim() : undefined,
          effort: effortOrUndefined(body.effort),
          extractEffort: effortOrUndefined(body.extractEffort),
        },
        { log: (m) => out.send({ type: "log", message: m }), onText: (t) => out.send({ type: "text", text: t }) },
      );
      out.send({ type: "done", file: r.outFile, usage: r.usage, model: r.model, meetings: r.meetings.length });
    } catch (err) {
      out.send({ type: "error", message: (err as Error).message });
    }
    return out.end();
  }

  if (route === "GET /api/profiles") return json(res, 200, { profiles: listProfiles() });

  if (route === "GET /api/conversations") {
    const dir = paths.conversations();
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse() : [];
    return json(res, 200, { conversations: files.map((f) => ({ name: f, path: path.join(dir, f) })) });
  }

  throw new HttpError(404, `No route ${route}`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else if (req.method === "GET") serveStatic(res, url.pathname);
    else json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    const e = err as HttpError;
    const status = typeof e.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500;
    if (!res.headersSent) json(res, status, { error: e.message });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Muesli GUI: http://${HOST}:${PORT}   (data: ${paths.root()})`);
});
