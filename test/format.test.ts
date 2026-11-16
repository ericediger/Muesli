import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCorpus, computeTranscriptStats, contentFlags, formatTranscript, normalizeContentMode } from "../src/corpus/format.js";
import type { Note, TranscriptItem } from "../src/granola/types.js";

const items: TranscriptItem[] = [
  { speaker: { source: "speaker", attribution: "them" }, text: "Hey Eric,", start_time: "2026-09-08T20:00:00Z", end_time: "2026-09-08T20:00:01Z" },
  { speaker: { source: "speaker", attribution: "them" }, text: "how are you?", start_time: "2026-09-08T20:00:01Z", end_time: "2026-09-08T20:00:02Z" },
  { speaker: { source: "microphone", attribution: "me" }, text: "Real good, thanks.", start_time: "2026-09-08T20:00:03Z", end_time: "2026-09-08T20:00:05Z" },
  { speaker: { source: "speaker", name: "Dana Whitfield" }, text: "Good.", start_time: "2026-09-08T20:01:05Z", end_time: "2026-09-08T20:01:06Z" },
];

test("formatTranscript merges consecutive turns and labels speakers", () => {
  const out = formatTranscript(items, { meName: "Eric Lund", themName: "Dana Whitfield" });
  assert.equal(
    out,
    ["[00:00:00] Dana Whitfield: Hey Eric, how are you?", "[00:00:03] Eric Lund: Real good, thanks.", "[00:01:05] Dana Whitfield: Good."].join("\n"),
  );
  const generic = formatTranscript(items.slice(0, 3), { meName: "Me", timestamps: false });
  assert.equal(generic, "Them: Hey Eric, how are you?\nMe: Real good, thanks.");
});

test("computeTranscriptStats counts words by attribution and collects names", () => {
  const s = computeTranscriptStats(items);
  assert.equal(s.items, 4);
  assert.equal(s.word_count, 9);
  assert.equal(s.me_words, 3);
  assert.equal(s.them_words, 5);
  assert.equal(s.unattributed_words, 1);
  assert.deepEqual(s.speaker_names, ["Dana Whitfield"]);
  assert.equal(s.duration_minutes, 1);
});

test("buildCorpus wraps notes in meeting tags and estimates tokens", () => {
  const note: Note = {
    id: "not_1d3tmExample01",
    object: "note",
    title: "260908 - Dana Whitfield",
    owner: { name: "Eric Lund", email: "eric@x.com" },
    created_at: "2026-09-08T19:57:57Z",
    updated_at: "2026-09-08T20:30:00Z",
    web_url: "https://notes.granola.ai/d/x",
    calendar_event: null,
    attendees: [],
    folder_membership: [],
    summary_text: "Summary here",
    summary_markdown: "# Summary here",
    private_notes_text: null,
    private_notes_markdown: null,
    transcript: items,
  };
  const c = buildCorpus([note], { meName: "Eric Lund", themName: "Dana Whitfield" });
  assert.equal(c.noteCount, 1);
  assert.equal(c.notesWithoutTranscript, 0);
  assert.match(c.text, /^<meeting id="not_1d3tmExample01" title="260908 - Dana Whitfield" date="2026-09-08"/);
  assert.match(c.text, /<summary>\n# Summary here\n<\/summary>/);
  assert.match(c.text, /Dana Whitfield: Hey Eric, how are you\?/);
  assert.ok(c.tokens > 0);
});

test("buildCorpus honours content modes", async () => {
  const { buildCorpus, contentFlags } = await import("../src/corpus/format.js");
  const note = {
    id: "not_1", object: "note" as const, title: "260908 - Dana Whitfield", owner: { name: "Eric Lund", email: "e@x.com" },
    created_at: "2026-09-08T19:57:57Z", updated_at: "2026-09-08T20:30:00Z", web_url: "", calendar_event: null, attendees: [], folder_membership: [],
    summary_text: "Summary here", summary_markdown: "# Summary here", private_notes_text: "my private note", private_notes_markdown: "my private note", transcript: items,
  };
  const notesOnly = buildCorpus([note], { meName: "Eric Lund", ...contentFlags("notes") });
  assert.doesNotMatch(notesOnly.text, /<transcript>/);
  assert.match(notesOnly.text, /<summary>/);
  assert.match(notesOnly.text, /<private_notes>/);
  assert.equal(notesOnly.notesWithoutTranscript, 0);
  const transcriptOnly = buildCorpus([note], { meName: "Eric Lund", ...contentFlags("transcript") });
  assert.match(transcriptOnly.text, /<transcript>/);
  assert.doesNotMatch(transcriptOnly.text, /<summary>|<private_notes>/);
  const both = buildCorpus([note], { meName: "Eric Lund", ...contentFlags("both", false) });
  assert.match(both.text, /<transcript>/);
  assert.match(both.text, /<summary>/);
  assert.doesNotMatch(both.text, /<private_notes>/);
});

test("Ask and Profiles fall back to transcripts only; Export keeps both", () => {
  assert.equal(normalizeContentMode(undefined, "transcript"), "transcript");
  assert.equal(normalizeContentMode("bogus", "transcript"), "transcript");
  assert.equal(normalizeContentMode("notes", "transcript"), "notes");
  assert.equal(normalizeContentMode(undefined), "both");
  assert.deepEqual(contentFlags("transcript"), { includeSummary: false, includePrivateNotes: false, includeTranscript: true });
});
