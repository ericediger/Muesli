import { test } from "node:test";
import assert from "node:assert/strict";
import { GranolaClient, GranolaApiError } from "../src/granola/client.js";

type Handler = (url: URL, init: RequestInit) => { status: number; body?: unknown; headers?: Record<string, string> };

function mockFetch(handler: Handler): { fetch: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    const r = handler(url, init ?? {});
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json", ...(r.headers ?? {}) },
    });
  }) as typeof fetch;
  return { fetch: f, calls };
}

const note = (id: string) => ({
  id,
  object: "note",
  title: `Note ${id}`,
  owner: { name: "Eric", email: "e@x.com" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
});

test("iterateNotes follows cursors and sends the bearer token", async () => {
  let auth = "";
  const { fetch: f, calls } = mockFetch((url, init) => {
    auth = String((init.headers as Record<string, string>).Authorization);
    const cursor = url.searchParams.get("cursor");
    if (!cursor) return { status: 200, body: { notes: [note("not_a"), note("not_b")], hasMore: true, cursor: "c2" } };
    return { status: 200, body: { notes: [note("not_c")], hasMore: false, cursor: null } };
  });
  const client = new GranolaClient({ apiKey: "grn_test", fetchImpl: f, rateLimit: false });
  const all = await client.listAllNotes({ created_after: "2026-08-01" });
  assert.deepEqual(all.map((n) => n.id), ["not_a", "not_b", "not_c"]);
  assert.equal(auth, "Bearer grn_test");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /created_after=2026-08-01/);
  assert.match(calls[1], /cursor=c2/);
});

test("getNoteWithTranscript falls back to the paginated transcript on 413", async () => {
  const { fetch: f, calls } = mockFetch((url) => {
    if (url.pathname === "/v1/notes/not_big" && url.searchParams.get("include") === "transcript") {
      return { status: 413, body: { error: "TRANSCRIPT_TOO_LARGE" } };
    }
    if (url.pathname === "/v1/notes/not_big") return { status: 200, body: { ...note("not_big"), transcript: null, attendees: [], folder_membership: [] } };
    if (url.pathname === "/v1/notes/not_big/transcript") {
      const cursor = url.searchParams.get("cursor");
      const item = (t: string) => ({ speaker: { source: "speaker", attribution: "them" }, text: t, start_time: "2026-09-01T00:00:00Z", end_time: "2026-09-01T00:00:01Z" });
      if (!cursor) return { status: 200, body: { transcript: [item("one"), item("two")], hasMore: true, cursor: "p2" } };
      return { status: 200, body: { transcript: [item("three")], hasMore: false, cursor: null } };
    }
    return { status: 404 };
  });
  const client = new GranolaClient({ apiKey: "grn_test", fetchImpl: f, rateLimit: false });
  const { note: n, transcriptSource } = await client.getNoteWithTranscript("not_big");
  assert.equal(transcriptSource, "paginated");
  assert.deepEqual(n.transcript?.map((t) => t.text), ["one", "two", "three"]);
  assert.equal(calls.length, 4);
});

test("request retries on 429 and surfaces 401 clearly", async () => {
  let n = 0;
  const { fetch: f } = mockFetch(() => {
    n += 1;
    if (n === 1) return { status: 429, headers: { "retry-after": "0" } };
    return { status: 200, body: { folders: [{ id: "fol_1", object: "folder", name: "BLUEBIRD", parent_folder_id: null }], hasMore: false, cursor: null } };
  });
  const client = new GranolaClient({ apiKey: "grn_test", fetchImpl: f, rateLimit: false, maxRetries: 1 });
  const folders = await client.listFolders();
  assert.equal(folders[0].name, "BLUEBIRD");
  assert.equal(n, 2);

  const bad = new GranolaClient({ apiKey: "grn_bad", fetchImpl: mockFetch(() => ({ status: 401 })).fetch, rateLimit: false });
  await assert.rejects(bad.listFolders(), (err: unknown) => err instanceof GranolaApiError && err.status === 401 && /API key/.test(err.message));
});
