import type { Command } from "commander";
import { addSelectOptions, describeSelection, resolveSelection, type SelectOptions } from "./select.js";
import { isoDate, log, table, truncate } from "../util.js";
import { isMe, parseTitleSubject } from "../people/people.js";
import type { Index, IndexEntry } from "../store/store.js";

export function whoColumn(e: IndexEntry, me: Index["me"]): string {
  // isMe also matches by name, so notes from another of my accounts (old work email) don't list me.
  const others = e.attendees.filter((a) => !isMe(a, me)).map((a) => a.name ?? a.email);
  if (others.length) return others.join(", ");
  const parsed = parseTitleSubject(e.title);
  if (parsed?.person) return parsed.person;
  if (e.speaker_names.length) return e.speaker_names.join(", ");
  return parsed?.subject ?? "";
}

export function registerSearch(program: Command): void {
  addSelectOptions(
    program
      .command("search")
      .description("Find notes in the local archive")
      .option("--json", "print matching index entries as JSON"),
  ).action((o: SelectOptions & { json?: boolean }) => {
    const { index, entries } = resolveSelection({ ...o, limit: o.limit ?? (o.search || o.person || o.ids ? undefined : "50") });
    if (o.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }
    log(`${entries.length} note(s) for ${describeSelection(o)}`);
    if (!entries.length) return;
    const rows = entries.map((e) => ({
      id: e.id,
      date: isoDate(e.created_at),
      title: truncate(e.title ?? "(untitled)", 48),
      who: truncate(whoColumn(e, index.me), 28),
      words: e.word_count,
      "me%": e.me_word_share === null ? "" : Math.round(e.me_word_share * 100),
      folders: truncate(e.folder_names.join(", "), 20),
    }));
    console.log(table(rows, ["id", "date", "title", "who", "words", "me%", "folders"]));
  });
}
