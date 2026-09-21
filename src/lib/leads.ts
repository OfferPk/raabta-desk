import { getDb } from "./db";
import type { Lead, Note, Stage, DashboardStats } from "./types";
import { OPEN_STAGES, STAGES } from "./types";
import { endOfTodayISO, startOfTodayISO } from "./format";

export function listLeads(opts?: {
  ownerId?: string;
  stage?: Stage;
}): Lead[] {
  const db = getDb();
  let sql = `
    SELECT l.*, u.name as owner_name
    FROM leads l
    JOIN users u ON u.id = l.owner_id
    WHERE 1=1
  `;
  const params: string[] = [];
  if (opts?.ownerId) {
    sql += " AND l.owner_id = ?";
    params.push(opts.ownerId);
  }
  if (opts?.stage) {
    sql += " AND l.stage = ?";
    params.push(opts.stage);
  }
  sql += " ORDER BY l.updated_at DESC";
  return db.prepare(sql).all(...params) as Lead[];
}

export function getLead(id: string): Lead | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT l.*, u.name as owner_name
       FROM leads l JOIN users u ON u.id = l.owner_id
       WHERE l.id = ?`
    )
    .get(id) as Lead | undefined;
  return row ?? null;
}

export function createLead(input: {
  name: string;
  phone: string;
  email?: string | null;
  source?: string | null;
  stage?: Stage;
  owner_id: string;
  value_cents?: number;
  currency?: string;
  next_follow_up?: string | null;
}): Lead {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO leads
      (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name.trim(),
    input.phone.trim(),
    input.email?.trim() || null,
    input.source?.trim() || null,
    input.stage || "new",
    input.owner_id,
    input.value_cents ?? 0,
    input.currency || "PKR",
    input.next_follow_up || null,
    now,
    now
  );
  return getLead(id)!;
}

export function updateLead(
  id: string,
  patch: Partial<{
    name: string;
    phone: string;
    email: string | null;
    source: string | null;
    stage: Stage;
    owner_id: string;
    value_cents: number;
    currency: string;
    next_follow_up: string | null;
  }>
): Lead | null {
  const existing = getLead(id);
  if (!existing) return null;

  const db = getDb();
  const next = {
    name: patch.name ?? existing.name,
    phone: patch.phone ?? existing.phone,
    email: patch.email !== undefined ? patch.email : existing.email,
    source: patch.source !== undefined ? patch.source : existing.source,
    stage: patch.stage ?? existing.stage,
    owner_id: patch.owner_id ?? existing.owner_id,
    value_cents: patch.value_cents ?? existing.value_cents,
    currency: patch.currency ?? existing.currency,
    next_follow_up:
      patch.next_follow_up !== undefined
        ? patch.next_follow_up
        : existing.next_follow_up,
  };
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE leads SET
      name = ?, phone = ?, email = ?, source = ?, stage = ?,
      owner_id = ?, value_cents = ?, currency = ?, next_follow_up = ?,
      updated_at = ?
     WHERE id = ?`
  ).run(
    next.name,
    next.phone,
    next.email,
    next.source,
    next.stage,
    next.owner_id,
    next.value_cents,
    next.currency,
    next.next_follow_up,
    now,
    id
  );
  return getLead(id);
}

export function deleteLead(id: string): boolean {
  const db = getDb();
  const info = db.prepare("DELETE FROM leads WHERE id = ?").run(id);
  return info.changes > 0;
}

export function listNotes(leadId: string): Note[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT n.*, u.name as user_name
       FROM notes n JOIN users u ON u.id = n.user_id
       WHERE n.lead_id = ?
       ORDER BY n.created_at ASC`
    )
    .all(leadId) as Note[];
}

export function addNote(leadId: string, userId: string, body: string): Note {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO notes (id, lead_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, leadId, userId, body.trim(), now);
  db.prepare("UPDATE leads SET updated_at = ? WHERE id = ?").run(now, leadId);
  return db
    .prepare(
      `SELECT n.*, u.name as user_name
       FROM notes n JOIN users u ON u.id = n.user_id
       WHERE n.id = ?`
    )
    .get(id) as Note;
}

export function followUpQueue(opts?: { ownerId?: string }): Lead[] {
  const db = getDb();
  const end = endOfTodayISO();
  let sql = `
    SELECT l.*, u.name as owner_name
    FROM leads l JOIN users u ON u.id = l.owner_id
    WHERE l.next_follow_up IS NOT NULL
      AND l.next_follow_up <= ?
      AND l.stage NOT IN ('won', 'lost')
  `;
  const params: string[] = [end];
  if (opts?.ownerId) {
    sql += " AND l.owner_id = ?";
    params.push(opts.ownerId);
  }
  sql += " ORDER BY l.next_follow_up ASC";
  return db.prepare(sql).all(...params) as Lead[];
}

export function getDashboardStats(opts?: {
  ownerId?: string;
}): DashboardStats {
  const db = getDb();
  const ownerFilter = opts?.ownerId ? " AND owner_id = ?" : "";
  const ownerParams = opts?.ownerId ? [opts.ownerId] : [];

  const counts = {} as Record<Stage, number>;
  for (const stage of STAGES) {
    const row = db
      .prepare(
        `SELECT COUNT(*) as c FROM leads WHERE stage = ?${ownerFilter}`
      )
      .get(stage, ...ownerParams) as { c: number };
    counts[stage] = row.c;
  }

  const start = startOfTodayISO();
  const end = endOfTodayISO();

  const overdue = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM leads
         WHERE next_follow_up IS NOT NULL
           AND next_follow_up < ?
           AND stage NOT IN ('won', 'lost')${ownerFilter}`
      )
      .get(start, ...ownerParams) as { c: number }
  ).c;

  const dueToday = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM leads
         WHERE next_follow_up IS NOT NULL
           AND next_follow_up >= ?
           AND next_follow_up <= ?
           AND stage NOT IN ('won', 'lost')${ownerFilter}`
      )
      .get(start, end, ...ownerParams) as { c: number }
  ).c;

  const openStages = OPEN_STAGES.map(() => "?").join(",");
  const pipeline = db
    .prepare(
      `SELECT COALESCE(SUM(value_cents), 0) as s, COALESCE(MAX(currency), 'PKR') as currency
       FROM leads
       WHERE stage IN (${openStages})${ownerFilter}`
    )
    .get(...OPEN_STAGES, ...ownerParams) as { s: number; currency: string };

  const total = (
    db
      .prepare(`SELECT COUNT(*) as c FROM leads WHERE 1=1${ownerFilter}`)
      .get(...ownerParams) as { c: number }
  ).c;

  return {
    counts,
    overdue,
    due_today: dueToday,
    open_pipeline_cents: pipeline.s,
    currency: pipeline.currency || "PKR",
    total_leads: total,
  };
}

export function canAccessLead(
  user: { id: string; role: string },
  lead: Lead
): boolean {
  if (user.role === "owner") return true;
  return lead.owner_id === user.id;
}
