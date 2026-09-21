# API — Raabta Desk

Base URL: same origin as the app (e.g. `http://localhost:3000`).

**Auth:** Session cookie `raabta_session` (httpOnly). Send cookies with browser `fetch` (`credentials: "include"`). No Bearer token.

## Conventions

- JSON endpoints: `Content-Type: application/json` (except upload multipart and CSV downloads).
- Errors: `{ "error": "<message string>" }` (not nested `{ error: { code } }`).
- Timestamps: ISO-8601 strings.
- Roles: `owner` \| `agent`. Stages: `new` \| `qualified` \| `follow_up` \| `won` \| `lost`.

**Session user shape** (returned by auth / `me`):

```json
{ "id": "uuid", "email": "…", "name": "…", "role": "owner" }
```

---

## Auth

### `POST /api/auth/register`

Create the **first** workspace user (becomes `owner`) and set session cookie.

**Auth:** Public. Returns **403** if any user already exists.

**Request**

```json
{ "name": "Ayesha", "email": "owner@example.com", "password": "secret1" }
```

- Password min length: 6.
- Email trimmed + lowercased.

**Response `201`**

```json
{ "user": { "id": "…", "email": "…", "name": "…", "role": "owner" } }
```

**Errors:** `400` missing fields / short password; `409` email taken; `403` workspace already has owner; `500`.

---

### `POST /api/auth/login`

**Auth:** Public.

**Request**

```json
{ "email": "owner@raabta.local", "password": "owner123" }
```

**Response `200`**

```json
{ "user": { "id": "…", "email": "…", "name": "…", "role": "owner" } }
```

Sets `raabta_session` cookie.

**Errors:** `400` missing email/password; `401` invalid credentials; `500`.

---

### `POST /api/auth/logout`

**Auth:** Optional (clears cookie even if session missing).

**Request:** empty body.

**Response `200`**

```json
{ "ok": true }
```

Destroys DB session (if present) and clears cookie.

---

### `GET /api/auth/me`

**Auth:** Session required.

**Response `200`**

```json
{ "user": { "id": "…", "email": "…", "name": "…", "role": "agent" } }
```

**Errors:** `401`.

---

## Users

### `GET /api/users`

**Auth:** Any signed-in user.

**Response `200`**

- Owner: full rows `{ id, email, name, role, created_at }`.
- Agent: `{ id, name, role }` only (email omitted).

```json
{ "users": [ /* … */ ], "me": { "id": "…", "email": "…", "name": "…", "role": "…" } }
```

---

### `POST /api/users`

Create an **agent** (Team). Always forces `role=agent`.

**Auth:** Owner only.

**Request**

```json
{ "name": "Sara", "email": "agent2@example.com", "password": "secret1" }
```

If `role` is sent as `"owner"` → `400` `"Only agent role can be created via Team"`.

**Response `201`**

```json
{ "user": { "id": "…", "email": "…", "name": "…", "role": "agent", "created_at": "…" } }
```

**Errors:** `400` validation; `401`/`403`; `409` email taken; `500`.

---

## Leads

### `GET /api/leads`

**Auth:** Session.

**Query:** optional `stage` (must be a valid stage).

- Owner: all leads.
- Agent: `owner_id =` self.

**Response `200`**

```json
{ "leads": [ /* Lead objects; may include owner_name */ ] }
```

---

### `POST /api/leads`

**Auth:** Session.

**Request**

```json
{
  "name": "Ali Khan",
  "phone": "03001234567",
  "email": null,
  "source": "whatsapp",
  "stage": "new",
  "owner_id": "uuid-optional-owner-only",
  "value": 50000,
  "currency": "PKR",
  "next_follow_up": "2026-09-22T10:00:00.000Z"
}
```

- `name` + `phone` required. Phone via `preparePhoneForStorage` (PK `03…` → `92…`); invalid → `400` with country-code hint.
- `value` / `value_rupees`: rupees → stored as `value_cents` (×100, clamped ≥ 0).
- Agents cannot set another `owner_id` (ignored); owners may if user exists.

**Response `201`:** `{ "lead": { … } }`

---

### `GET /api/leads/:id`

**Auth:** Session + can access lead (owner all; agent if `owner_id` matches).

**Response `200`**

```json
{ "lead": { /* … */ }, "notes": [ /* … */ ] }
```

**Errors:** `404`, `403`, `401`.

---

### `PATCH /api/leads/:id`

**Auth:** Session + can access lead.

Partial update. Supported fields: `name`, `phone`, `email`, `source`, `stage`, `owner_id` (owner only), `value` / `value_rupees` / `value_cents`, `currency`, `next_follow_up` (null clears).

Empty trimmed `name`/`phone` → `400`. Invalid phone/stage/`owner_id` → `400`.

**Response `200`:** `{ "lead": { … } }`

---

### `DELETE /api/leads/:id`

**Auth:** Session + can access lead.

**Response `200`:** `{ "ok": true }`

---

## Notes

### `POST /api/leads/:id/notes`

Append-only note.

**Auth:** Session + can access lead.

**Request**

```json
{ "body": "Called; will follow up tomorrow." }
```

Max length **5000** characters.

**Response `201`:** `{ "note": { "id", "lead_id", "user_id", "body", "created_at", … } }`

**Errors:** `400` empty / too long; `404`; `403`; `401`.

---

## Dashboard

### `GET /api/dashboard`

**Auth:** Session.

Scoped like leads (owner = all; agent = own).

**Response `200`**

```json
{
  "stats": {
    "counts": { "new": 0, "qualified": 0, "follow_up": 0, "won": 0, "lost": 0 },
    "overdue": 0,
    "due_today": 0,
    "open_pipeline_cents": 0,
    "currency": "PKR",
    "total_leads": 0
  },
  "follow_ups": [ /* Lead[] due today + overdue */ ]
}
```

---

## Export

### `GET /api/export/leads.csv`

**Auth:** Owner only (agents → `403`).

**Response `200`:** `text/csv; charset=utf-8` attachment `raabta-leads.csv`.

Columns: `id,name,phone,email,source,stage,owner_name,value_cents,currency,next_follow_up,created_at,updated_at`.

Cells sanitized against CSV formula injection (`src/lib/csv.ts`).

---

## Imports (Ads Drop)

Map targets: `name` \| `phone` \| `email` \| `meta_lead_id` \| `meta_campaign` \| `created_at` \| `note` \| `ignore`.

Job status: `uploaded` \| `mapped` \| `previewed` \| `committing` \| `done` \| `failed`.

**Job summary** (typical JSON `job` object): id, uploaded_by, uploaded_by_name, filename, status, headers[], mapping, sample_rows, row_count, default_owner_id, nudge_hours, note_on_match, created_count, skipped_dupes, skipped_invalid, note_on_match_count, error_count, error_summary, created_at, finished_at.

Access: owner sees all jobs; agent only jobs they uploaded.

---

### `GET /api/imports`

**Auth:** Session.

Lists up to 50 jobs (agent: own uploads).

**Response `200`:** `{ "jobs": [ /* job summaries */ ] }`

---

### `POST /api/imports`

Upload Meta CSV/XLSX.

**Auth:** Session.

**Request:** `multipart/form-data` with field **`file`** (required). Filename extension `.csv`, `.xlsx`, or `.xls`. Max **5 MB** / **2000** data rows.

**Response `201`:** `{ "job": { /* summary; status uploaded */ } }`

**Errors:** `400` missing file / parse / size / type; `401`; `500`.

---

### `GET /api/imports/:jobId`

**Auth:** Session + can access job.

**Query:** `include_rows=1` forces row list. Rows are also included when status is `done` or `failed`.

**Response `200`**

```json
{ "job": { /* summary */ }, "rows": [ /* optional; lead_id may be null for agents on foreign leads */ ] }
```

---

### `PATCH /api/imports/:jobId/mapping`

Save column mapping (+ options). Sets status `mapped` and returns preview tallies.

**Auth:** Session + can access job. Not allowed if status `done` or `committing` (`409`).

**Request**

```json
{
  "mapping": {
    "id": "meta_lead_id",
    "phone_number": "phone",
    "full_name": "name",
    "campaign_name": "meta_campaign"
  },
  "default_owner_id": "uuid",
  "nudge_hours": 2,
  "note_on_match": true,
  "save_preset_name": "Meta weekly"
}
```

- `mapping` required; each value must be a valid map target.
- `nudge_hours`: `null` or one of `0`, `2`, `4`, `24`.
- Agents always get themselves as default owner; owners may set `default_owner_id`.
- `save_preset_name` optional → upsert preset by header fingerprint.

**Response `200`**

```json
{
  "job": { /* … */ },
  "preview": {
    "would_create": 0,
    "would_dupe_meta": 0,
    "would_dupe_phone": 0,
    "would_invalid": 0,
    "would_note_on_match": 0
  }
}
```

---

### `POST /api/imports/:jobId/preview`

Recompute preview after mapping.

**Auth:** Session + can access job. Requires mapping already saved.

**Request:** empty body.

**Response `200`**

```json
{
  "job": { /* … */ },
  "preview": { "would_create": 0, "would_dupe_meta": 0, "would_dupe_phone": 0, "would_invalid": 0, "would_note_on_match": 0 },
  "sample_outcomes": [
    {
      "row_number": 1,
      "meta_lead_id": "…",
      "phone": "92300…",
      "name": "…",
      "outcome": "created",
      "message": null
    }
  ]
}
```

---

### `POST /api/imports/:jobId/commit`

Commit import into leads.

**Auth:** Session + can access job.

**Request**

```json
{ "confirm": true }
```

`confirm` must be true (`400` otherwise). Claims `committing` then writes in one transaction; duplicate commit → `409`.

Created leads: `source=meta_ads`, `stage=new`, value `0` PKR, optional `next_follow_up` from nudge, import note attached.

**Response `200`**

```json
{
  "job": { /* status done or failed; tallies filled */ },
  "report": {
    "created": 0,
    "skipped_dupes": 0,
    "skipped_invalid": 0,
    "note_on_match": 0,
    "errors": 0
  }
}
```

---

### `GET /api/imports/:jobId/report.csv`

**Auth:** Session + can access job.

**Response `200`:** CSV attachment `import-<jobId>-report.csv`.

Columns: `row_number,meta_lead_id,phone,outcome,lead_id,message`. Agent viewers get foreign `lead_id` blanked.

---

## Import presets

### `GET /api/imports/presets`

**Auth:** Session.

**Response `200`**

```json
{
  "presets": [
    {
      "id": "…",
      "name": "…",
      "header_fingerprint": "…",
      "mapping": { },
      "created_by": "…",
      "created_at": "…",
      "updated_at": "…"
    }
  ]
}
```

---

### `POST /api/imports/presets`

**Auth:** Session.

**Request**

```json
{
  "name": "Meta Instant Form",
  "mapping": { "phone_number": "phone", "full_name": "name" },
  "headers": ["id", "phone_number", "full_name"]
}
```

`mapping` required. `headers` optional (used for fingerprint when provided).

**Response `201`:** `{ "preset": { … } }`

---

### `DELETE /api/imports/presets/:id`

**Auth:** Session (any signed-in user who knows the id).

**Response `200`:** `{ "ok": true }`  
**Errors:** `404` if missing.

---

## Rate limits

None implemented in application code.

## Endpoint inventory

| # | Method | Path |
|---|--------|------|
| 1 | POST | `/api/auth/register` |
| 2 | POST | `/api/auth/login` |
| 3 | POST | `/api/auth/logout` |
| 4 | GET | `/api/auth/me` |
| 5 | GET | `/api/users` |
| 6 | POST | `/api/users` |
| 7 | GET | `/api/leads` |
| 8 | POST | `/api/leads` |
| 9 | GET | `/api/leads/:id` |
| 10 | PATCH | `/api/leads/:id` |
| 11 | DELETE | `/api/leads/:id` |
| 12 | POST | `/api/leads/:id/notes` |
| 13 | GET | `/api/dashboard` |
| 14 | GET | `/api/export/leads.csv` |
| 15 | GET | `/api/imports` |
| 16 | POST | `/api/imports` |
| 17 | GET | `/api/imports/:jobId` |
| 18 | PATCH | `/api/imports/:jobId/mapping` |
| 19 | POST | `/api/imports/:jobId/preview` |
| 20 | POST | `/api/imports/:jobId/commit` |
| 21 | GET | `/api/imports/:jobId/report.csv` |
| 22 | GET | `/api/imports/presets` |
| 23 | POST | `/api/imports/presets` |
| 24 | DELETE | `/api/imports/presets/:id` |

**18** `route.ts` files · **24** method+path handlers documented.
