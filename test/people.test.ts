import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyMeeting, collectPeople, parseTitleSubject, personMatchesEntry } from "../src/people/people.js";

const me = { email: "eric.lund@example.com", name: "Eric Lund" };
const owner = { name: "Eric Lund", email: me.email };

test("parseTitleSubject follows the YYMMDD - Name convention", () => {
  assert.equal(parseTitleSubject("260908 - Dana Whitfield")?.person, "Dana Whitfield");
  assert.equal(parseTitleSubject("260820 - Dana Whitfield Sync.")?.person, "Dana Whitfield");
  assert.equal(parseTitleSubject("260910 - Amy DeLuca")?.person, "Amy DeLuca");
  assert.equal(parseTitleSubject("260819 - Mary Kate Holm SYnc")?.person, "Mary Kate Holm");
  assert.equal(parseTitleSubject("260831 - Greta")?.maybeFirstName, "Greta");
  assert.equal(parseTitleSubject("260907 - Contoso Leadership")?.person, null);
  assert.equal(parseTitleSubject("260910 - IT INfra SYnc")?.person, null);
  assert.equal(parseTitleSubject("260818 -BrightPath sync")?.person, null);
  assert.equal(parseTitleSubject("260821 - Skyline Labs Presentation")?.person, null);
  assert.equal(parseTitleSubject("Pipeline deployment and staging strategy with Theo"), null);
});

test("personMatchesEntry matches via title, attendee and speaker", () => {
  const byTitle = { title: "260908 - Dana Whitfield", attendees: [owner], speaker_names: [], owner };
  assert.deepEqual(personMatchesEntry(byTitle, { name: "Dana Whitfield" }, me).via, ["title"]);
  assert.equal(personMatchesEntry(byTitle, { name: "dana" }, me).match, true);
  assert.equal(personMatchesEntry(byTitle, { name: "Dana Smith" }, me).match, false);

  const byAttendee = {
    title: "Eric Lund and Wingtip-Priya-Raman",
    attendees: [owner, { name: "Priya Raman", email: "priya@team.wingtip.example" }, { name: "Dana Whitfield", email: "dana.whitfield@example.com" }],
    speaker_names: [],
    owner,
  };
  assert.deepEqual(personMatchesEntry(byAttendee, { name: "Dana Whitfield" }, me).via, ["attendee"]);
  assert.deepEqual(personMatchesEntry(byAttendee, { name: "x", email: "dana.whitfield@example.com" }, me).via, ["email"]);

  const bySpeaker = { title: "Roadmap review", attendees: [owner], speaker_names: ["Eric Lund", "Marco Reyes"], owner };
  assert.deepEqual(personMatchesEntry(bySpeaker, { name: "Marco Reyes" }, me).via, ["speaker"]);
  assert.equal(personMatchesEntry(bySpeaker, { name: "Eric Lund" }, me).match, false, "never match me via speaker tag");
});

test("classifyMeeting separates one-on-ones from group meetings", () => {
  assert.equal(classifyMeeting({ title: "260908 - Dana Whitfield", attendees: [owner], speaker_names: [], owner }, { name: "Dana Whitfield" }, me), "one_on_one");
  assert.equal(classifyMeeting({ title: "260831 - Greta", attendees: [owner], speaker_names: [], owner }, { name: "Greta" }, me), "one_on_one");
  const group = {
    title: "Eric Lund and Wingtip-Priya-Raman",
    attendees: [owner, { name: "Priya Raman", email: "s@x.com" }, { name: "Dana Whitfield", email: "dana.whitfield@example.com" }],
    speaker_names: [],
    owner,
  };
  assert.equal(classifyMeeting(group, { name: "Dana Whitfield" }, me), "group");
  const twoSpeakers = { title: "Northwind Sync", attendees: [owner], speaker_names: ["Eric Lund", "Sam Lee", "Hannah Cole"], owner };
  assert.equal(classifyMeeting(twoSpeakers, { name: "Sam Lee" }, me), "group");
  const oneSpeaker = { title: "Northwind Sync", attendees: [owner], speaker_names: ["Eric Lund", "Sam Lee"], owner };
  assert.equal(classifyMeeting(oneSpeaker, { name: "Sam Lee" }, me), "one_on_one");
});

test("collectPeople aggregates names across titles, attendees and speakers", () => {
  const people = collectPeople(
    [
      { title: "260908 - Dana Whitfield", attendees: [owner], speaker_names: [], owner, created_at: "2026-09-08T19:57:57Z" },
      { title: "260813 - Dana Whitfield", attendees: [owner], speaker_names: [], owner, created_at: "2026-08-13T20:01:00Z" },
      { title: "Wingtip intro", attendees: [owner, { name: "Dana Whitfield", email: "dana.whitfield@example.com" }], speaker_names: [], owner, created_at: "2026-08-17T18:45:00Z" },
      { title: "260831 - Greta", attendees: [owner], speaker_names: [], owner, created_at: "2026-08-31T19:42:00Z" },
    ],
    me,
  );
  const dana = people.find((p) => p.name === "Dana Whitfield");
  assert.ok(dana);
  assert.equal(dana.meetings, 3);
  assert.deepEqual(dana.via, { title: 2, attendee: 1, speaker: 0 });
  assert.deepEqual(dana.emails, ["dana.whitfield@example.com"]);
  assert.equal(dana.last_seen, "2026-09-08T19:57:57Z");
  assert.ok(people.find((p) => p.name === "Greta"));
  assert.ok(!people.find((p) => p.name === "Eric Lund"));
});
