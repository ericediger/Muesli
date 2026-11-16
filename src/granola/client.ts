import { setTimeout as sleep } from "node:timers/promises";
import type {
  CreateWebhookEndpointBody,
  CreateWebhookEndpointOutput,
  GetTranscriptOutput,
  ListAuditOutput,
  ListFoldersOutput,
  ListNotesOutput,
  ListNotesParams,
  Note,
  NoteSummary,
  TranscriptItem,
  UpdateWebhookEndpointBody,
  WebhookEndpoint,
  GranolaFolder,
} from "./types.js";

export class GranolaApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "GranolaApiError";
  }
}

type FetchLike = typeof fetch;

/**
 * Token bucket matching Granola's published limits:
 * burst 25 requests / 5 s window, sustained 5 requests / second.
 */
class RateLimiter {
  private tokens: number;
  private last = Date.now();
  constructor(
    private readonly capacity = 25,
    private readonly refillPerSec = 5,
  ) {
    this.tokens = capacity;
  }
  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec);
      this.last = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.refillPerSec) * 1000);
      await sleep(waitMs);
    }
  }
}

export interface GranolaClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  maxRetries?: number;
  /** Disable the client-side token bucket (tests). */
  rateLimit?: boolean;
  onRequest?: (info: { method: string; url: string; attempt: number }) => void;
}

export class GranolaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxRetries: number;
  private readonly limiter: RateLimiter | null;
  private readonly onRequest?: GranolaClientOptions["onRequest"];

  constructor(opts: GranolaClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://public-api.granola.ai").replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxRetries = opts.maxRetries ?? 4;
    this.limiter = opts.rateLimit === false ? null : new RateLimiter();
    this.onRequest = opts.onRequest;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    query?: Record<string, string | number | undefined>,
    body?: unknown,
  ): Promise<{ status: number; data: T }> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    let attempt = 0;
    for (;;) {
      attempt += 1;
      if (this.limiter) await this.limiter.acquire();
      this.onRequest?.({ method, url: url.toString(), attempt });
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        if (attempt <= this.maxRetries) {
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }
        throw err;
      }

      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (res.ok) return { status: res.status, data: data as T };

      const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
      if (retryable && attempt <= this.maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** (attempt - 1);
        await sleep(backoff);
        continue;
      }
      const msg =
        res.status === 401
          ? "Granola rejected the API key (401). Check GRANOLA_API_KEY."
          : `Granola API ${method} ${path} failed with ${res.status}`;
      throw new GranolaApiError(res.status, msg, data);
    }
  }

  // ---- Notes -------------------------------------------------------------

  /** Iterate over every page of notes matching the filters (newest first, as returned by the API). */
  async *iterateNotes(params: ListNotesParams = {}): AsyncGenerator<NoteSummary, void, void> {
    let cursor: string | undefined;
    do {
      const { data } = await this.request<ListNotesOutput>("GET", "/v1/notes", {
        ...params,
        page_size: params.page_size ?? 30,
        cursor,
      });
      for (const n of data.notes) yield n;
      cursor = data.hasMore && data.cursor ? data.cursor : undefined;
    } while (cursor);
  }

  async listAllNotes(params: ListNotesParams = {}, limit?: number): Promise<NoteSummary[]> {
    const out: NoteSummary[] = [];
    for await (const n of this.iterateNotes(params)) {
      out.push(n);
      if (limit && out.length >= limit) break;
    }
    return out;
  }

  /** Get a note without its transcript. */
  async getNoteMetadata(noteId: string): Promise<Note> {
    const { data } = await this.request<Note>("GET", `/v1/notes/${encodeURIComponent(noteId)}`);
    return data;
  }

  /**
   * Get a note with its full transcript. Falls back to the paginated transcript
   * endpoint when the API answers 413 TRANSCRIPT_TOO_LARGE.
   */
  async getNoteWithTranscript(noteId: string): Promise<{ note: Note; transcriptSource: "inline" | "paginated" | "none" }> {
    try {
      const { data } = await this.request<Note>("GET", `/v1/notes/${encodeURIComponent(noteId)}`, {
        include: "transcript",
      });
      if (data.transcript && data.transcript.length > 0) return { note: data, transcriptSource: "inline" };
      // Some notes legitimately have an empty transcript; try the paginated endpoint once.
      const items = await this.getTranscript(noteId);
      return { note: { ...data, transcript: items }, transcriptSource: items.length ? "paginated" : "none" };
    } catch (err) {
      if (err instanceof GranolaApiError && err.status === 413) {
        const meta = await this.getNoteMetadata(noteId);
        const items = await this.getTranscript(noteId);
        return { note: { ...meta, transcript: items }, transcriptSource: "paginated" };
      }
      throw err;
    }
  }

  async getTranscript(noteId: string): Promise<TranscriptItem[]> {
    const items: TranscriptItem[] = [];
    let cursor: string | undefined;
    do {
      const { data } = await this.request<GetTranscriptOutput>(
        "GET",
        `/v1/notes/${encodeURIComponent(noteId)}/transcript`,
        { page_size: 100, cursor },
      );
      items.push(...data.transcript);
      cursor = data.hasMore && data.cursor ? data.cursor : undefined;
    } while (cursor);
    return items;
  }

  // ---- Folders -----------------------------------------------------------

  async listFolders(): Promise<GranolaFolder[]> {
    const out: GranolaFolder[] = [];
    let cursor: string | undefined;
    do {
      const { data } = await this.request<ListFoldersOutput>("GET", "/v1/folders", { page_size: 30, cursor });
      out.push(...data.folders);
      cursor = data.hasMore && data.cursor ? data.cursor : undefined;
    } while (cursor);
    return out;
  }

  // ---- Audit (present in the OpenAPI spec) --------------------------------

  async listAudit(params: { action?: string; occurred_after?: string; occurred_before?: string } = {}, limit = 100) {
    const out: ListAuditOutput["events"] = [];
    let cursor: string | undefined;
    do {
      const { data } = await this.request<ListAuditOutput>("GET", "/v1/audit", { ...params, page_size: 30, cursor });
      out.push(...data.events);
      cursor = data.hasMore && data.cursor ? data.cursor : undefined;
    } while (cursor && out.length < limit);
    return out;
  }

  // ---- Webhooks ----------------------------------------------------------

  async listWebhookEndpoints(): Promise<WebhookEndpoint[]> {
    const { data } = await this.request<{ webhook_endpoints: WebhookEndpoint[] }>("GET", "/v1/webhook-endpoints");
    return data.webhook_endpoints;
  }

  async createWebhookEndpoint(body: CreateWebhookEndpointBody): Promise<CreateWebhookEndpointOutput> {
    const { data } = await this.request<CreateWebhookEndpointOutput>("POST", "/v1/webhook-endpoints", undefined, body);
    return data;
  }

  async updateWebhookEndpoint(id: string, body: UpdateWebhookEndpointBody): Promise<WebhookEndpoint> {
    const { data } = await this.request<WebhookEndpoint>(
      "PATCH",
      `/v1/webhook-endpoints/${encodeURIComponent(id)}`,
      undefined,
      body,
    );
    return data;
  }

  async deleteWebhookEndpoint(id: string): Promise<void> {
    await this.request("DELETE", `/v1/webhook-endpoints/${encodeURIComponent(id)}`);
  }
}
