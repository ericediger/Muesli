import { z } from "zod";
import type { ContentMode } from "../corpus/format.js";

export const ObservationSchema = z.object({
  dimension: z.enum(["EQ", "IQ", "Professional"]),
  facet: z
    .string()
    .describe(
      "Short facet label, e.g. empathy, self-regulation, candor, conflict handling, self-awareness, analytical rigor, systems thinking, judgment, curiosity, domain expertise, follow-through, influence, organizational awareness, communication",
    ),
  polarity: z.enum(["strength", "growth_area", "neutral"]),
  observation: z.string().describe("What this reveals about the person, in one or two sentences"),
  evidence_quote: z
    .string()
    .describe("Verbatim words spoken BY THE PERSON (never by the note owner) that support the observation"),
  quote_attribution_certainty: z
    .enum(["high", "medium", "low"])
    .describe("How certain it is that the quoted words were spoken by the person rather than someone else"),
});

export const MeetingEvidenceSchema = z.object({
  meeting_id: z.string().describe("Copy the id attribute of the <meeting> tag exactly"),
  person_present: z.boolean().describe("true if the person clearly takes part in this transcript"),
  person_talk_share: z.number().describe("Estimated fraction of the conversation spoken by the person, from 0 to 1"),
  topics: z.array(z.string()).describe("3 to 8 short topic labels for the meeting"),
  observations: z.array(ObservationSchema).describe("6 to 15 observations spread across EQ, IQ and Professional"),
  commitments_by_person: z.array(
    z.object({ commitment: z.string(), quote: z.string().describe("verbatim words of the person") }),
  ),
  commitments_to_person: z
    .array(z.object({ commitment: z.string(), quote: z.string() }))
    .describe("Things the note owner committed to do for or with the person"),
  dynamics_with_owner: z
    .string()
    .describe("How the person related to the note owner in this meeting: tone, trust signals, tension, who drove the agenda"),
  notable_moments: z.array(z.string()).describe("Up to 5 moments worth remembering, each one sentence"),
});

export type MeetingEvidence = z.infer<typeof MeetingEvidenceSchema>;

const NOTES_ONLY_EXTRACT = (person: string) => `

Content available in this run: only Granola's AI-generated meeting notes (the summary and the note owner's own private notes), NOT the transcript. Treat every statement in the notes as a paraphrase, never as verbatim speech. Put the supporting note text in evidence_quote, set quote_attribution_certainty to "medium" at most, and favour observations about what ${person} raised, committed to, decided or pushed back on over claims about tone, phrasing or word choice, which the notes cannot support.`;

const NOTES_ONLY_SYNTH = `

Content caveat: the evidence comes from Granola's AI-generated notes rather than transcripts. Do not present note text as verbatim quotes; label evidence as "from notes". Keep confidence at medium or lower for facets that depend on actual wording (self-regulation, candor, communication style), and say so once in the context paragraph.`;

export function extractSystemPrompt(person: string, meName: string, mode: ContentMode = "both"): string {
  return `You extract evidence about one person from a single meeting record.${mode === "notes" ? NOTES_ONLY_EXTRACT(person) : ""}

The person of interest is ${person}. The note owner (whose Granola captured the meeting) is ${meName}. Transcript lines are labelled with a speaker name; lines labelled "${meName}" are the note owner, lines labelled "${person}" or "Them" are most likely ${person} in a one-on-one, but in group meetings "Them" may be anyone other than ${meName}.

Rules:
- Only quote words spoken by ${person}. Never attribute ${meName}'s words to ${person}. When you are not sure who spoke a line, set quote_attribution_certainty to "medium" or "low" or leave the observation out.
- Observations must be grounded in what ${person} actually said or did in this transcript, not in what others said about them.
- Distinguish behaviour from inference. Avoid clinical or diagnostic language; this is a professional working profile.
- Cover the three dimensions:
  EQ: self-awareness, self-regulation under pressure, empathy and reading others, social skill, candor, conflict handling, response to being challenged.
  IQ: analytical rigor, systems and strategic thinking, speed versus depth, curiosity and learning, judgment under uncertainty, quality of questions.
  Professional: domain expertise and credibility, execution and follow-through, priorities and motivations, organizational and political awareness, communication style, reliability.
- Quotes must be verbatim from the transcript (light trimming with ellipses is fine).`;
}

export function synthesisSystemPrompt(person: string, meName: string, mode: ContentMode = "both"): string {
  return `You are writing a working-relationship profile of ${person} for ${meName}, based solely on records of ${meName}'s conversations with ${person} (one-on-ones and group meetings) and on per-meeting evidence notes extracted from those records.${mode === "notes" ? NOTES_ONLY_SYNTH : ""}

Purpose: help ${meName} understand, work with, and support ${person} better. It is not a performance review, a hiring decision, or a clinical assessment. Everything here is an inference from how ${person} talks in these particular conversations with ${meName}; say so once, then be direct.

Write in Markdown with exactly this structure:

# ${person} — working profile
One paragraph of context: number of meetings, date range, what kinds of conversations these were, and the main caveats (sample size, attribution quality).

## Snapshot
5 to 8 bullets with the most load-bearing conclusions, each with a confidence tag (high / medium / low).

## Emotional intelligence (EQ)
Sub-headings for: self-awareness; self-regulation under pressure; empathy and reading others; social skill and influence; candor and conflict handling; response to being challenged or wrong. For each: assessment, confidence, and 1 to 3 verbatim quotes with (meeting title, YYYY-MM-DD).

## Intellectual style (IQ)
Sub-headings for: analytical rigor; systems and strategic thinking; speed versus depth; curiosity and learning; judgment under uncertainty. Same evidence format.

## Professional
Sub-headings for: domain expertise and credibility; execution and follow-through (compare commitments made with what was later reported done); priorities and motivations; organizational and political awareness; communication style; reliability signals. Same evidence format.

## Trajectory
What changed across the period: topics, tone, confidence, the relationship with ${meName}.

## Working with ${person}
Practical dos and don'ts for ${meName}, each tied to evidence.

## Open questions and gaps
What the evidence cannot tell you, and what to watch for next.

## Evidence log
A Markdown table: date | meeting | key observation | quote.

Rules:
- Quote only words spoken by ${person}. Never attribute ${meName}'s words to ${person}. Where attribution is uncertain, say so.
- Prefer patterns seen in two or more meetings; label single-instance observations as such.
- Be candid, specific, and useful. No flattery, no hedging every sentence, no diagnostic language.
- Use the raw transcripts (when provided) to verify and enrich the extracted evidence; the evidence notes are a starting point, not the ceiling.`;
}
