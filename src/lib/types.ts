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
