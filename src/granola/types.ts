// Types transcribed from https://docs.granola.ai/api-reference/openapi.json (v1.5.0, Sept 2026).

export interface GranolaUser {
  name: string | null;
  email: string;
}

export interface GranolaFolder {
  id: string; // fol_xxxxxxxxxxxxxx
  object: "folder";
  name: string;
  parent_folder_id: string | null;
}

export interface Speaker {
  source: "microphone" | "speaker";
  /** `me` = note owner, `them` = other participants. Omitted when unknown. */
  attribution?: "me" | "them";
  /** iOS only: anonymous diarized label such as "Speaker A". */
  diarization_label?: string;
  /** Present only when the speaker could be identified (speaker tags). */
  name?: string;
}

export interface TranscriptItem {
  speaker: Speaker;
  text: string;
  start_time: string; // ISO date-time
  end_time: string; // ISO date-time
}

export interface CalendarInvitee {
  email: string;
}

export interface CalendarEvent {
  event_title: string | null;
  invitees: CalendarInvitee[];
  organiser: string | null;
  calendar_event_id: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
}

export interface NoteSummary {
  id: string; // not_xxxxxxxxxxxxxx
  object: "note";
  title: string | null;
  owner: GranolaUser;
  created_at: string;
  updated_at: string;
}

export interface Note extends NoteSummary {
  web_url: string;
  calendar_event: CalendarEvent | null;
  attendees: GranolaUser[];
  folder_membership: GranolaFolder[];
  summary_text: string;
  summary_markdown: string | null;
  private_notes_text: string | null;
  private_notes_markdown: string | null;
  transcript: TranscriptItem[] | null;
}

export interface ListNotesOutput {
  notes: NoteSummary[];
  hasMore: boolean;
  cursor: string | null;
}

export interface GetTranscriptOutput {
  transcript: TranscriptItem[];
  hasMore: boolean;
  cursor: string | null;
}

export interface ListFoldersOutput {
  folders: GranolaFolder[];
  hasMore: boolean;
  cursor: string | null;
}

export interface AuditEvent {
  id: string;
  object: "audit_event";
  [key: string]: unknown;
}

export interface ListAuditOutput {
  events: AuditEvent[];
  hasMore: boolean;
  cursor: string | null;
}

export type WebhookEvent = "note.access_granted" | "note.edited" | "note.generated";
export type WebhookScope = "personal" | "public" | "workspace";

export interface WebhookEndpoint {
  id: string;
  object: "webhook_endpoint";
  url: string;
  url_redacted: boolean;
  events: WebhookEvent[];
  folder_ids: string[];
  scopes: WebhookScope[];
  created_by: GranolaUser | null;
  enabled: boolean;
  created_at: string;
}

export interface CreateWebhookEndpointBody {
  url: string;
  scopes: WebhookScope[];
  events?: WebhookEvent[];
  folder_ids?: string[];
}

export interface CreateWebhookEndpointOutput extends WebhookEndpoint {
  signing_secret: string;
}

export interface UpdateWebhookEndpointBody {
  url?: string;
  scopes?: WebhookScope[];
  events?: WebhookEvent[];
  folder_ids?: string[];
  enabled?: boolean;
}

export interface ListNotesParams {
  created_before?: string;
  created_after?: string;
  updated_after?: string;
  folder_id?: string;
  page_size?: number; // 1..30
}
