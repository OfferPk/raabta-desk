import { getDb } from "./db";
import type { Lead, Note, Stage, DashboardStats } from "./types";
import { preparePhoneForStorage } from "./phone";
import { OPEN_STAGES, STAGES } from "./types";
import { endOfTodayISO, startOfTodayISO } from "./format";
import { getImportRemindDays, getStaleDays } from "./settings";

export function listLeads(opts?: {
  ownerId?: string;
  stage?: Stage;
  /** When false (default), hide soft-archived leads. */
  includeArchived?: boolean;
  /** When true, only return archived leads (implies includeArchived). */
  archivedOnly?: boolean;
  /** Substring match on name / phone / email (case-insensitive). */
  q?: string;
  source?: string;
  meta_campaign?: string;
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
  if (opts?.source) {
    sql += " AND l.source = ?";
    params.push(opts.source);
  }
  if (opts?.meta_campaign) {
    sql += " AND l.meta_campaign = ?";
    params.push(opts.meta_campaign);
  }
  if (opts?.q && opts.q.trim()) {
    const like = `%${opts.q.trim().toLowerCase()}%`;
    sql += ` AND (
      lower(l.name) LIKE ? OR
      lower(l.phone) LIKE ? OR
      lower(COALESCE(l.email, '')) LIKE ?
    )`;
    params.push(like, like, like);
  }
  if (opts?.archivedOnly) {
    sql += " AND l.archived_at IS NOT NULL";
  } else if (!opts?.includeArchived) {
    sql += " AND l.archived_at IS NULL";
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

export function findLeadByMetaId(metaLeadId: string): Lead | null {
  if (!metaLeadId) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT l.*, u.name as owner_name
       FROM leads l JOIN users u ON u.id = l.owner_id
       WHERE l.meta_lead_id = ?`
    )
    .get(metaLeadId) as Lead | undefined;
  return row ?? null;
}

export function findLeadByPhone(phone: string): Lead | null {
  if (!phone) return null;
  const norm = preparePhoneForStorage(phone);
  if (!norm) return null;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT l.*, u.name as owner_name
       FROM leads l JOIN users u ON u.id = l.owner_id`
    )
    .all() as Lead[];
  return (
    rows.find((r) => preparePhoneForStorage(r.phone) === norm) ?? null
  );
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
  meta_lead_id?: string | null;
  meta_campaign?: string | null;
  created_at?: string | null;
}): Lead {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const createdAt = input.created_at || now;
  db.prepare(
    `INSERT INTO leads
      (id, name, phone, email, source, stage, owner_id, value_cents, currency,
       next_follow_up, created_at, updated_at, meta_lead_id, meta_campaign, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
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
    createdAt,
    now,
    input.meta_lead_id?.trim() || null,
    input.meta_campaign?.trim() || null
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
    meta_lead_id: string | null;
    meta_campaign: string | null;
    archived_at: string | null;
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
    meta_lead_id:
      patch.meta_lead_id !== undefined
        ? patch.meta_lead_id
        : existing.meta_lead_id ?? null,
    meta_campaign:
      patch.meta_campaign !== undefined
        ? patch.meta_campaign
        : existing.meta_campaign ?? null,
    archived_at:
      patch.archived_at !== undefined
        ? patch.archived_at
        : existing.archived_at ?? null,
  };
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE leads SET
      name = ?, phone = ?, email = ?, source = ?, stage = ?,
      owner_id = ?, value_cents = ?, currency = ?, next_follow_up = ?,
      meta_lead_id = ?, meta_campaign = ?, archived_at = ?,
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
    next.meta_lead_id,
    next.meta_campaign,
    next.archived_at,
    now,
    id
  );
  return getLead(id);
}

export function setLeadArchived(id: string, archived: boolean): Lead | null {
  return updateLead(id, {
    archived_at: archived ? new Date().toISOString() : null,
  });
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
      AND l.archived_at IS NULL
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
  const activeFilter = " AND archived_at IS NULL";

  const counts = {} as Record<Stage, number>;
  for (const stage of STAGES) {
    const row = db
      .prepare(
        `SELECT COUNT(*) as c FROM leads WHERE stage = ?${activeFilter}${ownerFilter}`
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
           AND stage NOT IN ('won', 'lost')${activeFilter}${ownerFilter}`
      )
      .get(start, ...ownerParams) as { c: number }
  ).c;

  const overdueValue = (
    db
      .prepare(
        `SELECT COALESCE(SUM(value_cents), 0) as s FROM leads
         WHERE next_follow_up IS NOT NULL
           AND next_follow_up < ?
           AND stage NOT IN ('won', 'lost')${activeFilter}${ownerFilter}`
      )
      .get(start, ...ownerParams) as { s: number }
  ).s;

  const dueToday = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM leads
         WHERE next_follow_up IS NOT NULL
           AND next_follow_up >= ?
           AND next_follow_up <= ?
           AND stage NOT IN ('won', 'lost')${activeFilter}${ownerFilter}`
      )
      .get(start, end, ...ownerParams) as { c: number }
  ).c;

  const openStages = OPEN_STAGES.map(() => "?").join(",");
  const pipeline = db
    .prepare(
      `SELECT COALESCE(SUM(value_cents), 0) as s, COALESCE(MAX(currency), 'PKR') as currency
       FROM leads
       WHERE stage IN (${openStages})${activeFilter}${ownerFilter}`
    )
    .get(...OPEN_STAGES, ...ownerParams) as { s: number; currency: string };

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM leads WHERE 1=1${activeFilter}${ownerFilter}`
      )
      .get(...ownerParams) as { c: number }
  ).c;

  const archivedCount = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM leads WHERE archived_at IS NOT NULL${ownerFilter}`
      )
      .get(...ownerParams) as { c: number }
  ).c;

  const staleDays = getStaleDays();
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - staleDays);
  const staleIso = staleCutoff.toISOString();
  const staleLeads = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM leads
         WHERE stage NOT IN ('won', 'lost')
           AND updated_at < ?
           ${activeFilter}${ownerFilter}`
      )
      .get(staleIso, ...ownerParams) as { c: number }
  ).c;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const importsThisWeek = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM import_jobs
         WHERE status = 'done' AND finished_at IS NOT NULL AND finished_at >= ?`
      )
      .get(weekAgo.toISOString()) as { c: number }
  ).c;

  const lastImport = db
    .prepare(
      `SELECT finished_at FROM import_jobs
       WHERE status = 'done' AND finished_at IS NOT NULL
       ORDER BY finished_at DESC LIMIT 1`
    )
    .get() as { finished_at: string } | undefined;

  const importRemindDays = getImportRemindDays();
  let importCadenceDue = false;
  if (!lastImport) {
    // No imports yet — nudge if there are any leads (or always for owner empty Ads Drop awareness)
    importCadenceDue = true;
  } else {
    const last = new Date(lastImport.finished_at).getTime();
    const threshold = importRemindDays * 24 * 60 * 60 * 1000;
    importCadenceDue = Date.now() - last >= threshold;
  }

  return {
    counts,
    overdue,
    due_today: dueToday,
    open_pipeline_cents: pipeline.s,
    currency: pipeline.currency || "PKR",
    total_leads: total,
    archived_count: archivedCount,
    stale_leads: staleLeads,
    overdue_value_cents: overdueValue,
    imports_this_week: importsThisWeek,
    last_import_at: lastImport?.finished_at ?? null,
    import_remind_days: importRemindDays,
    import_cadence_due: importCadenceDue,
  };
}

export function canAccessLead(
  user: { id: string; role: string },
  lead: Lead
): boolean {
  if (user.role === "owner") return true;
  return lead.owner_id === user.id;
}

/** Create a bilingual sample lead for empty-state onboarding. */
export function createSampleLead(ownerId: string): Lead {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const lead = createLead({
    name: "Sample Lead (Demo)",
    phone: "923001234567",
    email: null,
    source: "sample",
    stage: "new",
    owner_id: ownerId,
    value_cents: 5000000,
    currency: "PKR",
    next_follow_up: tomorrow.toISOString(),
  });
  addNote(
    lead.id,
    ownerId,
    "Sample note — pehli WhatsApp baat ke baad yahan likho. / Write your first chat summary here."
  );
  return lead;
}
