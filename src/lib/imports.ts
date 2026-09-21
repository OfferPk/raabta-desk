import { getDb } from "./db";
import {
  addNote,
  canAccessLead,
  createLead,
  findLeadByMetaId,
  findLeadByPhone,
  getLead,
} from "./leads";
import { preparePhoneForStorage } from "./phone";
import {
  defaultMapping,
  headerFingerprint,
  parseMetaTimestamp,
  validateMapping,
} from "./import-map";
import type {
  ImportJob,
  ImportJobRow,
  ImportMappingPreset,
  ImportPreviewTallies,
  ImportSampleOutcome,
  ImportRowOutcome,
  MapTarget,
  SessionUser,
} from "./types";

const NOTE_MAX = 5000;

export class ImportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function jobSummary(job: ImportJob) {
  return {
    id: job.id,
    uploaded_by: job.uploaded_by,
    uploaded_by_name: job.uploaded_by_name,
    filename: job.filename,
    status: job.status,
    headers: JSON.parse(job.headers_json) as string[],
    mapping: job.mapping_json
      ? (JSON.parse(job.mapping_json) as Record<string, MapTarget>)
      : null,
    sample_rows: job.sample_rows_json
      ? (JSON.parse(job.sample_rows_json) as Record<string, string>[])
      : null,
    row_count: job.row_count,
    default_owner_id: job.default_owner_id,
    nudge_hours: job.nudge_hours,
    note_on_match: !!job.note_on_match,
    created_count: job.created_count,
    skipped_dupes: job.skipped_dupes,
    skipped_invalid: job.skipped_invalid,
    note_on_match_count: job.note_on_match_count,
    error_count: job.error_count,
    error_summary: job.error_summary,
    created_at: job.created_at,
    finished_at: job.finished_at,
  };
}

export function canAccessJob(
  user: SessionUser,
  job: ImportJob
): boolean {
  if (user.role === "owner") return true;
  return job.uploaded_by === user.id;
}

/** Redact lead_id when the viewer cannot access that lead (M2). */
export function serializeJobRow(
  user: SessionUser,
  r: ImportJobRow
): {
  id: string;
  row_number: number;
  meta_lead_id: string | null;
  phone_raw: string | null;
  phone_norm: string | null;
  outcome: ImportJobRow["outcome"];
  lead_id: string | null;
  message: string | null;
  created_at: string;
} {
  let leadId = r.lead_id;
  if (leadId) {
    const lead = getLead(leadId);
    if (!lead || !canAccessLead(user, lead)) {
      leadId = null;
    }
  }
  return {
    id: r.id,
    row_number: r.row_number,
    meta_lead_id: r.meta_lead_id,
    phone_raw: r.phone_raw,
    phone_norm: r.phone_norm,
    outcome: r.outcome,
    lead_id: leadId,
    message: r.message,
    created_at: r.created_at,
  };
}

export function getJob(jobId: string): ImportJob | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT j.*, u.name as uploaded_by_name
       FROM import_jobs j
       JOIN users u ON u.id = j.uploaded_by
       WHERE j.id = ?`
    )
    .get(jobId) as ImportJob | undefined;
  return row ?? null;
}

export function listJobs(opts?: { uploadedBy?: string; limit?: number }): ImportJob[] {
  const db = getDb();
  const limit = opts?.limit ?? 50;
  if (opts?.uploadedBy) {
    return db
      .prepare(
        `SELECT j.*, u.name as uploaded_by_name
         FROM import_jobs j
         JOIN users u ON u.id = j.uploaded_by
         WHERE j.uploaded_by = ?
         ORDER BY j.created_at DESC
         LIMIT ?`
      )
      .all(opts.uploadedBy, limit) as ImportJob[];
  }
  return db
    .prepare(
      `SELECT j.*, u.name as uploaded_by_name
       FROM import_jobs j
       JOIN users u ON u.id = j.uploaded_by
       ORDER BY j.created_at DESC
       LIMIT ?`
    )
    .all(limit) as ImportJob[];
}

export function listJobRows(jobId: string): ImportJobRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM import_job_rows WHERE job_id = ? ORDER BY row_number ASC`
    )
    .all(jobId) as ImportJobRow[];
}

export function createImportJob(input: {
  uploadedBy: string;
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
}): ImportJob {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sample = input.rows.slice(0, 5);
  const mapping = defaultMapping(input.headers);
  const fp = headerFingerprint(input.headers);

  // Auto-apply preset if fingerprint matches
  const preset = db
    .prepare(
      `SELECT * FROM import_mapping_presets WHERE header_fingerprint = ?`
    )
    .get(fp) as ImportMappingPreset | undefined;
  const mappingJson = preset ? preset.mapping_json : JSON.stringify(mapping);

  db.prepare(
    `INSERT INTO import_jobs
      (id, uploaded_by, filename, status, headers_json, mapping_json,
       sample_rows_json, row_count, default_owner_id, nudge_hours, note_on_match,
       created_at)
     VALUES (?, ?, ?, 'uploaded', ?, ?, ?, ?, ?, 0, 0, ?)`
  ).run(
    id,
    input.uploadedBy,
    input.filename,
    JSON.stringify(input.headers),
    mappingJson,
    JSON.stringify(sample),
    input.rows.length,
    input.uploadedBy,
    now
  );

  const insertRow = db.prepare(
    `INSERT INTO import_job_rows
      (id, job_id, row_number, meta_lead_id, phone_raw, phone_norm, outcome, lead_id, message, raw_json, created_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, 'pending', NULL, NULL, ?, ?)`
  );

  const txn = db.transaction(() => {
    for (let i = 0; i < input.rows.length; i++) {
      insertRow.run(
        crypto.randomUUID(),
        id,
        i + 1,
        JSON.stringify(input.rows[i]),
        now
      );
    }
  });
  txn();

  return getJob(id)!;
}

/** Neutralize leading spreadsheet formula chars (= + - @). */
export function sanitizeSpreadsheetText(v: string): string {
  const s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) return "'" + s;
  return s;
}

function getMappedValue(
  row: Record<string, string>,
  mapping: Record<string, MapTarget>,
  target: MapTarget
): string {
  const parts: string[] = [];
  for (const [header, t] of Object.entries(mapping)) {
    if (t === target && row[header]) parts.push(row[header]);
  }
  if (target === "name" && parts.length > 1) return parts.join(" ").trim();
  return (parts[0] || "").trim();
}

function buildImportNote(
  row: Record<string, string>,
  mapping: Record<string, MapTarget>
): string {
  const lines: string[] = ["[Meta Ads import]"];
  const preferKeys = [
    "campaign_name",
    "form_name",
    "ad_name",
    "adset_name",
    "platform",
    "is_organic",
    "campaign_id",
    "ad_id",
    "adset_id",
    "form_id",
  ];
  const seen = new Set<string>();

  for (const key of preferKeys) {
    const header = Object.keys(row).find(
      (h) => h.trim().toLowerCase() === key
    );
    if (header && row[header]) {
      lines.push(`${header}: ${row[header]}`);
      seen.add(header);
    }
  }

  for (const [header, t] of Object.entries(mapping)) {
    if (t === "note" && row[header] && !seen.has(header)) {
      lines.push(`${header}: ${row[header]}`);
      seen.add(header);
    }
  }

  // Also include meta_campaign / created_at in note for context if mapped there
  const campaign = getMappedValue(row, mapping, "meta_campaign");
  if (campaign && !lines.some((l) => l.includes(campaign))) {
    lines.push(`campaign: ${campaign}`);
  }

  let body = lines.join("\n");
  if (body.length > NOTE_MAX) {
    body = body.slice(0, NOTE_MAX - 1) + "…";
  }
  return body;
}

type RowEval = {
  row_number: number;
  meta_lead_id: string | null;
  phone_raw: string | null;
  phone_norm: string | null;
  name: string | null;
  email: string | null;
  meta_campaign: string | null;
  created_at: string | null;
  outcome: ImportRowOutcome;
  message: string | null;
  note_body: string;
  existing_lead_id: string | null;
  raw: Record<string, string>;
};

function evaluateRows(
  job: ImportJob,
  rows: ImportJobRow[],
  mapping: Record<string, MapTarget>,
  noteOnMatch: boolean,
  user: SessionUser
): RowEval[] {
  const results: RowEval[] = [];
  // Track meta ids / phones created within this job for intra-file dupes
  const seenMeta = new Set<string>();
  const seenPhone = new Set<string>();

  for (const r of rows) {
    const raw = JSON.parse(r.raw_json) as Record<string, string>;
    const metaId = getMappedValue(raw, mapping, "meta_lead_id") || null;
    const phoneRaw = getMappedValue(raw, mapping, "phone") || null;
    const rawName =
      getMappedValue(raw, mapping, "name") ||
      (metaId ? `Meta lead ${metaId}` : `Import row ${r.row_number}`);
    const name = sanitizeSpreadsheetText(rawName);
    const email = getMappedValue(raw, mapping, "email") || null;
    const campaign = getMappedValue(raw, mapping, "meta_campaign") || null;
    const createdRaw = getMappedValue(raw, mapping, "created_at");
    const createdAt = parseMetaTimestamp(createdRaw);
    const noteBody = buildImportNote(raw, mapping);

    const phoneNorm = phoneRaw ? preparePhoneForStorage(phoneRaw) : null;

    let outcome: ImportRowOutcome = "created";
    let message: string | null = null;
    let existingLeadId: string | null = null;

    if (!phoneNorm) {
      outcome = "invalid";
      message = "Invalid or missing phone";
    } else if (metaId && (seenMeta.has(metaId) || findLeadByMetaId(metaId))) {
      outcome = "duplicate_meta_id";
      message = "Duplicate meta_lead_id";
      const existing = findLeadByMetaId(metaId);
      existingLeadId = existing?.id ?? null;
    } else if (seenPhone.has(phoneNorm) || findLeadByPhone(phoneNorm)) {
      const existing = findLeadByPhone(phoneNorm);
      existingLeadId = existing?.id ?? null;
      // M1: note_on_match only for leads the importer can access
      if (noteOnMatch && existing && canAccessLead(user, existing)) {
        outcome = "note_on_match";
        message = "Phone match — note appended";
      } else {
        outcome = "duplicate_phone";
        message = "Duplicate phone";
      }
    }

    if (outcome === "created") {
      if (metaId) seenMeta.add(metaId);
      seenPhone.add(phoneNorm!);
    }

    results.push({
      row_number: r.row_number,
      meta_lead_id: metaId,
      phone_raw: phoneRaw,
      phone_norm: phoneNorm,
      name,
      email,
      meta_campaign: campaign,
      created_at: createdAt,
      outcome,
      message,
      note_body: noteBody,
      existing_lead_id: existingLeadId,
      raw,
    });
  }
  return results;
}

function talliesFromEvals(
  evals: RowEval[]
): ImportPreviewTallies & { would_note_on_match: number } {
  const t = {
    would_create: 0,
    would_dupe_meta: 0,
    would_dupe_phone: 0,
    would_invalid: 0,
    would_note_on_match: 0,
  };
  for (const e of evals) {
    if (e.outcome === "created") t.would_create++;
    else if (e.outcome === "duplicate_meta_id") t.would_dupe_meta++;
    else if (e.outcome === "duplicate_phone") t.would_dupe_phone++;
    else if (e.outcome === "invalid") t.would_invalid++;
    else if (e.outcome === "note_on_match") t.would_note_on_match++;
  }
  return t;
}

export function updateMapping(
  jobId: string,
  user: SessionUser,
  body: {
    mapping: Record<string, MapTarget>;
    default_owner_id?: string;
    nudge_hours?: number | null;
    note_on_match?: boolean;
    save_preset_name?: string;
  }
): { job: ImportJob; preview: ImportPreviewTallies } {
  const job = getJob(jobId);
  if (!job) throw new ImportError("Job not found", 404);
  if (!canAccessJob(user, job)) throw new ImportError("Forbidden", 403);
  if (job.status === "done" || job.status === "committing") {
    throw new ImportError("Job already committed", 409);
  }

  const v = validateMapping(body.mapping);
  if (!v.ok) throw new ImportError(v.error);

  let ownerId = job.default_owner_id || user.id;
  if (user.role === "agent") {
    ownerId = user.id;
  } else if (body.default_owner_id) {
    const db = getDb();
    const owner = db
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(String(body.default_owner_id));
    if (!owner) throw new ImportError("Invalid default_owner_id");
    ownerId = String(body.default_owner_id);
  }

  let nudge: number | null =
    body.nudge_hours !== undefined ? body.nudge_hours : job.nudge_hours;
  if (nudge !== null && nudge !== undefined) {
    const n = Number(nudge);
    if (Number.isNaN(n) || ![0, 2, 4, 24].includes(n)) {
      throw new ImportError(
        "nudge_hours must be null or one of 0, 2, 4, 24",
        400
      );
    }
    nudge = n;
  }

  const noteOnMatch =
    body.note_on_match !== undefined
      ? body.note_on_match
        ? 1
        : 0
      : job.note_on_match;

  const db = getDb();
  db.prepare(
    `UPDATE import_jobs SET
      mapping_json = ?, default_owner_id = ?, nudge_hours = ?, note_on_match = ?,
      status = 'mapped'
     WHERE id = ?`
  ).run(
    JSON.stringify(body.mapping),
    ownerId,
    nudge,
    noteOnMatch,
    jobId
  );

  if (body.save_preset_name?.trim()) {
    const headers = JSON.parse(job.headers_json) as string[];
    upsertPreset({
      name: body.save_preset_name.trim(),
      headers,
      mapping: body.mapping,
      createdBy: user.id,
    });
  }

  const updated = getJob(jobId)!;
  const rows = listJobRows(jobId);
  const mapping = body.mapping;
  const evals = evaluateRows(updated, rows, mapping, !!noteOnMatch, user);
  return { job: updated, preview: talliesFromEvals(evals) };
}

export function previewJob(
  jobId: string,
  user: SessionUser
): {
  preview: ImportPreviewTallies;
  sample_outcomes: ImportSampleOutcome[];
  job: ImportJob;
} {
  const job = getJob(jobId);
  if (!job) throw new ImportError("Job not found", 404);
  if (!canAccessJob(user, job)) throw new ImportError("Forbidden", 403);
  if (!job.mapping_json) {
    throw new ImportError("Map columns before preview");
  }
  if (job.status === "done") {
    throw new ImportError("Job already committed", 409);
  }

  const mapping = JSON.parse(job.mapping_json) as Record<string, MapTarget>;
  const rows = listJobRows(jobId);
  const evals = evaluateRows(job, rows, mapping, !!job.note_on_match, user);
  const preview = talliesFromEvals(evals);
  const sample_outcomes: ImportSampleOutcome[] = evals.slice(0, 20).map((e) => ({
    row_number: e.row_number,
    meta_lead_id: e.meta_lead_id,
    phone: e.phone_norm || e.phone_raw,
    name: e.name,
    outcome: e.outcome,
    message: e.message,
  }));

  const db = getDb();
  db.prepare(`UPDATE import_jobs SET status = 'previewed' WHERE id = ?`).run(
    jobId
  );

  return { preview, sample_outcomes, job: getJob(jobId)! };
}

export function commitJob(
  jobId: string,
  user: SessionUser,
  confirm: boolean
): {
  job: ImportJob;
  report: {
    created: number;
    skipped_dupes: number;
    skipped_invalid: number;
    note_on_match: number;
    errors: number;
  };
} {
  if (!confirm) throw new ImportError("confirm must be true");
  const job = getJob(jobId);
  if (!job) throw new ImportError("Job not found", 404);
  if (!canAccessJob(user, job)) throw new ImportError("Forbidden", 403);
  if (job.status === "done") {
    throw new ImportError("Job already committed", 409);
  }
  if (!job.mapping_json) {
    throw new ImportError("Map columns before commit");
  }

  const mapping = JSON.parse(job.mapping_json) as Record<string, MapTarget>;
  const v = validateMapping(mapping);
  if (!v.ok) throw new ImportError(v.error);

  const ownerId =
    user.role === "agent" ? user.id : job.default_owner_id || user.id;
  const db = getDb();
  const owner = db.prepare("SELECT id FROM users WHERE id = ?").get(ownerId);
  if (!owner) throw new ImportError("Invalid default_owner_id");

  // M3: claim commit slot — reject if already done or in-flight
  const claim = db
    .prepare(
      `UPDATE import_jobs SET status = 'committing'
       WHERE id = ? AND status NOT IN ('done', 'committing')`
    )
    .run(jobId);
  if (claim.changes === 0) {
    throw new ImportError("Job already committed", 409);
  }

  let created = 0;
  let skippedDupes = 0;
  let skippedInvalid = 0;
  let noteOnMatchCount = 0;
  let errors = 0;
  let errorSummary: string | null = null;

  const updateRow = db.prepare(
    `UPDATE import_job_rows SET
      meta_lead_id = ?, phone_raw = ?, phone_norm = ?, outcome = ?,
      lead_id = ?, message = ?
     WHERE job_id = ? AND row_number = ?`
  );

  const run = db.transaction(() => {
    // M3: evaluate inside the same transaction as writes
    const rows = listJobRows(jobId);
    const evals = evaluateRows(
      job,
      rows,
      mapping,
      !!job.note_on_match,
      user
    );

    for (const e of evals) {
      try {
        if (e.outcome === "invalid") {
          skippedInvalid++;
          updateRow.run(
            e.meta_lead_id,
            e.phone_raw,
            e.phone_norm,
            "invalid",
            null,
            e.message,
            jobId,
            e.row_number
          );
          continue;
        }

        if (e.outcome === "duplicate_meta_id" || e.outcome === "duplicate_phone") {
          skippedDupes++;
          updateRow.run(
            e.meta_lead_id,
            e.phone_raw,
            e.phone_norm,
            e.outcome,
            e.existing_lead_id,
            e.message,
            jobId,
            e.row_number
          );
          continue;
        }

        if (e.outcome === "note_on_match") {
          if (e.existing_lead_id) {
            addNote(e.existing_lead_id, user.id, e.note_body);
          }
          noteOnMatchCount++;
          updateRow.run(
            e.meta_lead_id,
            e.phone_raw,
            e.phone_norm,
            "note_on_match",
            e.existing_lead_id,
            e.message,
            jobId,
            e.row_number
          );
          continue;
        }

        // created
        let nextFollow: string | null = null;
        if (job.nudge_hours !== null && job.nudge_hours !== undefined) {
          const d = new Date();
          d.setHours(d.getHours() + Number(job.nudge_hours));
          nextFollow = d.toISOString();
        }

        const lead = createLead({
          name: e.name || `Import row ${e.row_number}`,
          phone: e.phone_norm!,
          email: e.email,
          source: "meta_ads",
          stage: "new",
          owner_id: ownerId,
          value_cents: 0,
          currency: "PKR",
          next_follow_up: nextFollow,
          meta_lead_id: e.meta_lead_id,
          meta_campaign: e.meta_campaign,
          created_at: e.created_at,
        });
        addNote(lead.id, user.id, e.note_body);
        created++;
        updateRow.run(
          e.meta_lead_id,
          e.phone_raw,
          e.phone_norm,
          "created",
          lead.id,
          null,
          jobId,
          e.row_number
        );
      } catch (err) {
        errors++;
        errorSummary = String(err);
        updateRow.run(
          e.meta_lead_id,
          e.phone_raw,
          e.phone_norm,
          "error",
          null,
          String(err),
          jobId,
          e.row_number
        );
      }
    }

    const finished = new Date().toISOString();
    db.prepare(
      `UPDATE import_jobs SET
        status = ?, created_count = ?, skipped_dupes = ?, skipped_invalid = ?,
        note_on_match_count = ?, error_count = ?, error_summary = ?, finished_at = ?
       WHERE id = ?`
    ).run(
      errors && created === 0 && skippedDupes === 0 && skippedInvalid === 0
        ? "failed"
        : "done",
      created,
      skippedDupes,
      skippedInvalid,
      noteOnMatchCount,
      errors,
      errorSummary,
      finished,
      jobId
    );
  });

  try {
    run();
  } catch (err) {
    db.prepare(
      `UPDATE import_jobs SET status = 'failed', error_summary = ?, finished_at = ? WHERE id = ?`
    ).run(String(err), new Date().toISOString(), jobId);
    throw new ImportError(`Commit failed: ${err}`, 500);
  }

  const updated = getJob(jobId)!;
  return {
    job: updated,
    report: {
      created,
      skipped_dupes: skippedDupes,
      skipped_invalid: skippedInvalid,
      note_on_match: noteOnMatchCount,
      errors,
    },
  };
}

export function listPresets(): ImportMappingPreset[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM import_mapping_presets ORDER BY updated_at DESC`
    )
    .all() as ImportMappingPreset[];
}

export function upsertPreset(input: {
  name: string;
  headers: string[];
  mapping: Record<string, MapTarget>;
  createdBy: string;
}): ImportMappingPreset {
  const db = getDb();
  const fp = headerFingerprint(input.headers);
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `SELECT * FROM import_mapping_presets WHERE header_fingerprint = ?`
    )
    .get(fp) as ImportMappingPreset | undefined;

  if (existing) {
    db.prepare(
      `UPDATE import_mapping_presets SET name = ?, mapping_json = ?, updated_at = ? WHERE id = ?`
    ).run(input.name, JSON.stringify(input.mapping), now, existing.id);
    return db
      .prepare(`SELECT * FROM import_mapping_presets WHERE id = ?`)
      .get(existing.id) as ImportMappingPreset;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO import_mapping_presets
      (id, name, header_fingerprint, mapping_json, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    fp,
    JSON.stringify(input.mapping),
    input.createdBy,
    now,
    now
  );
  return db
    .prepare(`SELECT * FROM import_mapping_presets WHERE id = ?`)
    .get(id) as ImportMappingPreset;
}

export function createPreset(input: {
  name: string;
  mapping: Record<string, MapTarget>;
  headers?: string[];
  createdBy: string;
}): ImportMappingPreset {
  if (!input.name.trim()) throw new ImportError("Name required");
  const v = validateMapping(input.mapping);
  if (!v.ok) throw new ImportError(v.error);
  const headers = input.headers?.length
    ? input.headers
    : Object.keys(input.mapping);
  return upsertPreset({
    name: input.name.trim(),
    headers,
    mapping: input.mapping,
    createdBy: input.createdBy,
  });
}

export function deletePreset(id: string): boolean {
  const db = getDb();
  const info = db
    .prepare(`DELETE FROM import_mapping_presets WHERE id = ?`)
    .run(id);
  return info.changes > 0;
}

export function findPresetByHeaders(
  headers: string[]
): ImportMappingPreset | null {
  const db = getDb();
  const fp = headerFingerprint(headers);
  return (
    (db
      .prepare(
        `SELECT * FROM import_mapping_presets WHERE header_fingerprint = ?`
      )
      .get(fp) as ImportMappingPreset | undefined) ?? null
  );
}
