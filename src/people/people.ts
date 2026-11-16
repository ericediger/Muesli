import type { GranolaUser } from "../granola/types.js";

/** Words that mark a title as a project/recurring meeting rather than a person. */
const NON_PERSON_WORDS = new Set(
  `leadership roadmap sprint status pipeline presentation preso demo walkthrough workflows workflow marketing product
   conference legal sow msa infra infrastructure automation northwind moderna paypal openai ctmi converge carrier crrier gbta
   vlog tech fight club goldspring dataart ms uk us team all hands offsite planning kickoff retro standup stand-up deployment
   staging strategy integration configuration proposal pilot proof concept approval budget quarterly weekly monthly
   internal external sales pitch onboarding training workshop interview panel board committee council summit expo`
    .split(/\s+/)
    .filter(Boolean),
);

const QUALIFIERS =
  /\b(sync|syncs|synco|1:1|1-1|1on1|one[- ]on[- ]one|weekly|bi-?weekly|monthly|check-?in|catch-?up|touch ?base|call|meeting|mtg|chat|update|follow-?up|internal|prep|review|intro|coffee)\b\.?/gi;

const STOP_TOKENS = new Set(["and", "with", "the", "of", "for", "a", "an", "to", "in", "on", "at", "by", "from", "&"]);

export function canonicalName(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^[\s\-–—:.,]+|[\s\-–—:.,]+$/g, "").trim();
}

/** Lowercase alphabetic tokens of a name, minus connector words. */
export function nameTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length > 0 && !STOP_TOKENS.has(t));
}

export interface TitleSubject {
  /** Cleaned subject after the "YYMMDD - " prefix and qualifier words are removed. */
  subject: string;
  /** Subject when it looks like a person's name (2-4 name-like tokens, none an obvious org/meeting word). */
  person: string | null;
  /** Single capitalised token that may be a first name ("Greta"). */
  maybeFirstName: string | null;
}

/**
 * Parse titles that follow the "YYMMDD - Person Name" convention
 * (also tolerates "260820 - Dana Whitfield Sync." and "260818 -BrightPath sync").
 */
export function parseTitleSubject(title: string | null | undefined): TitleSubject | null {
  if (!title) return null;
  const m = title.match(/^\s*\d{6}\s*[-–—:]\s*(.+?)\s*$/);
  if (!m) return null;
  const subject = canonicalName(m[1]);
  const cleaned = canonicalName(subject.replace(QUALIFIERS, " ").replace(/[()\[\],.:;/]+/g, " "));
  const toks = cleaned.split(" ").filter(Boolean);
  const nameLike = (t: string) => /^[A-Za-z][A-Za-z'’-]*$/.test(t) && !NON_PERSON_WORDS.has(t.toLowerCase());
  if (toks.length >= 2 && toks.length <= 4 && toks.every(nameLike)) {
    return { subject, person: toks.join(" "), maybeFirstName: null };
  }
  if (toks.length === 1 && nameLike(toks[0]) && /^[A-Z]/.test(toks[0])) {
    return { subject, person: null, maybeFirstName: toks[0] };
  }
  return { subject, person: null, maybeFirstName: null };
}

export interface PersonQuery {
  name: string;
  email?: string;
}

export interface PersonMatch {
  match: boolean;
  via: Array<"title" | "attendee" | "email" | "speaker">;
}

export interface MatchableEntry {
  title: string | null;
  attendees: GranolaUser[];
  speaker_names: string[];
  owner: GranolaUser;
}

function wordRegex(token: string): RegExp {
  return new RegExp(`(^|[^a-z])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
}

export function isMe(u: GranolaUser | null | undefined, me: { email: string | null; name: string | null }): boolean {
  if (!u) return false;
  if (me.email && u.email && u.email.toLowerCase() === me.email.toLowerCase()) return true;
  if (me.name && u.name && nameTokens(u.name).join(" ") === nameTokens(me.name).join(" ")) return true;
  return false;
}

/** Whether a free-text string contains every token of the query name as whole words. */
export function textHasAllTokens(text: string | null | undefined, tokens: string[]): boolean {
  if (!text || tokens.length === 0) return false;
  const lower = text.toLowerCase();
  return tokens.every((t) => wordRegex(t).test(lower));
}

export function personMatchesEntry(
  entry: MatchableEntry,
  q: PersonQuery,
  me: { email: string | null; name: string | null },
): PersonMatch {
  const tokens = nameTokens(q.name);
  const via: PersonMatch["via"] = [];
  if (tokens.length === 0 && !q.email) return { match: false, via };

  if (textHasAllTokens(entry.title, tokens)) via.push("title");

  for (const a of entry.attendees) {
    if (isMe(a, me)) continue;
    if (q.email && a.email.toLowerCase() === q.email.toLowerCase()) {
      via.push("email");
      break;
    }
    const local = a.email.split("@")[0].replace(/[._-]+/g, " ");
    if ((a.name && tokens.length && nameTokens(a.name).length && tokens.every((t) => nameTokens(a.name!).includes(t))) ||
        (tokens.length && textHasAllTokens(local, tokens))) {
      via.push("attendee");
      break;
    }
  }

  for (const s of entry.speaker_names) {
    if (me.name && nameTokens(s).join(" ") === nameTokens(me.name).join(" ")) continue;
    if (tokens.length && tokens.every((t) => nameTokens(s).includes(t))) {
      via.push("speaker");
      break;
    }
  }

  return { match: via.length > 0, via };
}

export type MeetingKind = "one_on_one" | "group" | "unclear";

/**
 * Classify a meeting relative to a person. Titles following the
 * "YYMMDD - Person" convention are treated as the strongest one-on-one signal,
 * because desktop-captured notes carry no calendar attendee list.
 */
export function classifyMeeting(
  entry: MatchableEntry,
  q: PersonQuery,
  me: { email: string | null; name: string | null },
): MeetingKind {
  const tokens = nameTokens(q.name);
  const others = entry.attendees.filter((a) => !isMe(a, me));
  const otherSpeakers = entry.speaker_names.filter(
    (s) => !(me.name && nameTokens(s).join(" ") === nameTokens(me.name).join(" ")),
  );
  const personAmongOthers = others.some(
    (a) =>
      (q.email && a.email.toLowerCase() === q.email.toLowerCase()) ||
      (a.name && tokens.every((t) => nameTokens(a.name!).includes(t))),
  );
  if (others.length > 1 && personAmongOthers) return "group";
  if (otherSpeakers.length > 1) return "group";

  const parsed = parseTitleSubject(entry.title);
  if (parsed?.person && tokens.every((t) => nameTokens(parsed.person!).includes(t))) return "one_on_one";
  if (parsed?.maybeFirstName && tokens.length === 1 && nameTokens(parsed.maybeFirstName)[0] === tokens[0]) return "one_on_one";
  if (others.length === 1 && personAmongOthers) return "one_on_one";
  if (otherSpeakers.length === 1 && tokens.every((t) => nameTokens(otherSpeakers[0]).includes(t))) return "one_on_one";
  if (others.length > 1) return "group";
  return "unclear";
}

export interface PersonCandidate {
  name: string;
  meetings: number;
  via: { title: number; attendee: number; speaker: number };
  emails: string[];
  last_seen: string;
}

/** Build a list of probable people from titles, attendees and speaker tags. */
export function collectPeople(
  entries: Array<MatchableEntry & { created_at: string }>,
  me: { email: string | null; name: string | null },
): PersonCandidate[] {
  const byKey = new Map<string, PersonCandidate>();
  const bump = (name: string, via: keyof PersonCandidate["via"], email: string | null, seen: string) => {
    const key = nameTokens(name).join(" ");
    if (!key) return;
    let c = byKey.get(key);
    if (!c) {
      c = { name: canonicalName(name), meetings: 0, via: { title: 0, attendee: 0, speaker: 0 }, emails: [], last_seen: seen };
      byKey.set(key, c);
    }
    c.meetings += 1;
    c.via[via] += 1;
    if (email && !c.emails.includes(email)) c.emails.push(email);
    if (seen > c.last_seen) c.last_seen = seen;
  };
  for (const e of entries) {
    const seenNames = new Set<string>();
    const parsed = parseTitleSubject(e.title);
    const titleName = parsed?.person ?? parsed?.maybeFirstName ?? null;
    if (titleName) {
      bump(titleName, "title", null, e.created_at);
      seenNames.add(nameTokens(titleName).join(" "));
    }
    for (const a of e.attendees) {
      if (isMe(a, me) || !a.name) continue;
      const k = nameTokens(a.name).join(" ");
      if (seenNames.has(k)) {
        const c = byKey.get(k);
        if (c && !c.emails.includes(a.email)) c.emails.push(a.email);
        continue;
      }
      bump(a.name, "attendee", a.email, e.created_at);
      seenNames.add(k);
    }
    for (const s of e.speaker_names) {
      if (me.name && nameTokens(s).join(" ") === nameTokens(me.name).join(" ")) continue;
      const k = nameTokens(s).join(" ");
      if (seenNames.has(k)) continue;
      bump(s, "speaker", null, e.created_at);
      seenNames.add(k);
    }
  }
  return [...byKey.values()].sort((a, b) => b.meetings - a.meetings || a.name.localeCompare(b.name));
}
