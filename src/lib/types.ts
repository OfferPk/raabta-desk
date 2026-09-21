export type Role = "owner" | "agent";

export type Stage = "new" | "qualified" | "follow_up" | "won" | "lost";

export const STAGES: Stage[] = ["new", "qualified", "follow_up", "won", "lost"];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  qualified: "Qualified",
  follow_up: "Follow-up",
  won: "Won",
  lost: "Lost",
};

export const OPEN_STAGES: Stage[] = ["new", "qualified", "follow_up"];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  stage: Stage;
  owner_id: string;
  value_cents: number;
  currency: string;
  next_follow_up: string | null;
  created_at: string;
  updated_at: string;
  meta_lead_id?: string | null;
  meta_campaign?: string | null;
  owner_name?: string;
}

export interface Note {
  id: string;
  lead_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user_name?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface DashboardStats {
  counts: Record<Stage, number>;
  overdue: number;
  due_today: number;
  open_pipeline_cents: number;
  currency: string;
  total_leads: number;
}

export type ImportJobStatus =
  | "uploaded"
  | "mapped"
  | "previewed"
  | "committing"
  | "done"
  | "failed";

export type ImportRowOutcome =
  | "pending"
  | "created"
  | "duplicate_meta_id"
  | "duplicate_phone"
  | "invalid"
  | "note_on_match"
  | "error";

export type MapTarget =
  | "name"
  | "phone"
  | "email"
  | "meta_lead_id"
  | "meta_campaign"
  | "created_at"
  | "note"
  | "ignore";

export const MAP_TARGETS: MapTarget[] = [
  "name",
  "phone",
  "email",
  "meta_lead_id",
  "meta_campaign",
  "created_at",
  "note",
  "ignore",
];

export interface ImportJob {
  id: string;
  uploaded_by: string;
  filename: string;
  status: ImportJobStatus;
  headers_json: string;
  mapping_json: string | null;
  sample_rows_json: string | null;
  row_count: number;
  default_owner_id: string | null;
  nudge_hours: number | null;
  note_on_match: number;
  created_count: number;
  skipped_dupes: number;
  skipped_invalid: number;
  note_on_match_count: number;
  error_count: number;
  error_summary: string | null;
  created_at: string;
  finished_at: string | null;
  uploaded_by_name?: string;
}

export interface ImportJobRow {
  id: string;
  job_id: string;
  row_number: number;
  meta_lead_id: string | null;
  phone_raw: string | null;
  phone_norm: string | null;
  outcome: ImportRowOutcome;
  lead_id: string | null;
  message: string | null;
  raw_json: string;
  created_at: string;
}

export interface ImportMappingPreset {
  id: string;
  name: string;
  header_fingerprint: string;
  mapping_json: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ImportPreviewTallies {
  would_create: number;
  would_dupe_meta: number;
  would_dupe_phone: number;
  would_invalid: number;
  would_note_on_match: number;
}

export interface ImportSampleOutcome {
  row_number: number;
  meta_lead_id: string | null;
  phone: string | null;
  name: string | null;
  outcome: ImportRowOutcome;
  message: string | null;
}
