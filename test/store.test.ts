import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFields, searchIndex, type Index, type IndexEntry } from "../src/store/store.js";

const owner = { name: "Eric Lund", email: "eric.lund@example.com" };
const entry = (over: Partial<IndexEntry>): IndexEntry => ({
  id: "not_x",
  title: null,
  title_person: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  owner,
  web_url: "",
  attendees: [owner],
  folder_ids: [],
  folder_names: [],
  summary_text: "",
  has_private_notes: false,
  has_transcript: true,
  transcript_items: 10,
  word_count: 100,
  me_word_share: 0.5,
  duration_minutes: 10,
  speaker_names: [],
  fetched_at: "2026-09-12T00:00:00Z",
  ...over,
});

const index: Index = {
  version: 1,
  updated_at: "",
  last_sync_at: null,
  me: { email: owner.email, name: owner.name },
  notes: [
    entry({ id: "not_a", title: "260813 - Northwind Sync", title_person: null, summary_text: "Chat context options.", created_at: "2026-08-13T00:00:00Z" }),
    entry({ id: "not_b", title: "260908 - Dana Whitfield", title_person: "Dana Whitfield", summary_text: "Harbor vs Summit; Northwind plugin discussion.", created_at: "2026-09-08T00:00:00Z" }),
    entry({ id: "not_c", title: "Roadmap review", summary_text: "Quarterly planning.", folder_names: ["BLUEBIRD"], speaker_names: ["Eric Lund", "Marco Reyes"], created_at: "2026-09-02T00:00:00Z" }),
  ],
};

test("search defaults to title, summary, people and folders", () => {
  assert.deepEqual(searchIndex(index, { q: "northwind" }).map((e) => e.id), ["not_b", "not_a"]);
});

test("search can be restricted to the title only", () => {
  assert.deepEqual(searchIndex(index, { q: "northwind", fields: ["title"] }).map((e) => e.id), ["not_a"]);
  assert.deepEqual(searchIndex(index, { q: "northwind", fields: ["summary"] }).map((e) => e.id), ["not_b"]);
  assert.deepEqual(searchIndex(index, { q: "harbor", fields: ["title"] }), []);
});

test("people field covers speaker tags and title persons; folders field covers folder names", () => {
  assert.deepEqual(searchIndex(index, { q: "marco reyes", fields: ["people"] }).map((e) => e.id), ["not_c"]);
  assert.deepEqual(searchIndex(index, { q: "dana", fields: ["people"] }).map((e) => e.id), ["not_b"]);
  assert.deepEqual(searchIndex(index, { q: "bluebird", fields: ["folders"] }).map((e) => e.id), ["not_c"]);
  assert.deepEqual(searchIndex(index, { q: "bluebird", fields: ["title"] }), []);
});

test("normalizeFields accepts arrays or comma lists and drops unknown names", () => {
  assert.deepEqual(normalizeFields("title, Summary,bogus"), ["title", "summary"]);
  assert.deepEqual(normalizeFields(["transcript", "transcript"]), ["transcript"]);
  assert.equal(normalizeFields("nope"), undefined);
  assert.equal(normalizeFields(undefined), undefined);
});
