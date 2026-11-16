import type { Command } from "commander";
import { collectPeople } from "../people/people.js";
import { loadIndex } from "../store/store.js";
import { isoDate, table, truncate } from "../util.js";

export function registerPeople(program: Command): void {
  program
    .command("people")
    .description("List people found in note titles, attendee lists and speaker tags")
    .option("--min <n>", "only people seen in at least this many meetings", "1")
    .option("--json", "print as JSON")
    .action((o: { min: string; json?: boolean }) => {
      const index = loadIndex();
      if (!index.notes.length) throw new Error("The local archive is empty. Run: npm run granola -- sync");
      const people = collectPeople(index.notes, index.me).filter((p) => p.meetings >= Number(o.min));
      if (o.json) {
        console.log(JSON.stringify(people, null, 2));
        return;
      }
      const rows = people.map((p) => ({
        name: p.name,
        meetings: p.meetings,
        title: p.via.title,
        attendee: p.via.attendee,
        speaker: p.via.speaker,
        email: truncate(p.emails.join(", "), 34),
        last_seen: isoDate(p.last_seen),
      }));
      console.log(table(rows, ["name", "meetings", "title", "attendee", "speaker", "email", "last_seen"]));
      console.log(`\n${people.length} people. Columns title/attendee/speaker count how each person was detected. Use: profile "<name>"`);
    });
}
