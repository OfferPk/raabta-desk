# Architecture — Raabta Desk

## Purpose

WhatsApp-first shared lead & follow-up desk for SMB teams. Single-tenant Next.js app with SQLite: capture leads, Kanban stages, notes, follow-ups, CSV export, and **Ads Drop** (Meta Lead Ads CSV/XLSX → desk leads). No Meta Cloud API, Marketing API, or WABA.

## High-level diagram

```text
[Browser UI]
    │  App Router pages + fetch
    ▼
[Next.js API routes]  ──httpOnly cookie──►  [sessions table]
    │
    ├── auth (bcrypt + UUID sessions)
    ├── leads / notes / users / dashboard / export
    └── imports (parse → map → preview → commit)
            │
            ▼
      [SQLite via better-sqlite3]
      data/raabta.db (WAL)
```

## Components

| Component | Responsibility | Location |
|-----------|----------------|----------|
| App Router UI | Login/register + desk pages (dashboard, board, leads, follow-ups, team, Ads Drop) | `src/app/` |
| API routes | JSON/CSV/multipart handlers | `src/app/api/**/route.ts` |
| Auth | Password hash/verify, session create/destroy, cookie Secure policy, `requireUser` / `requireOwner` | `src/lib/auth.ts` |
| DB | SQLite open, WAL, foreign keys, schema migrate | `src/lib/db.ts` |
| Leads domain | CRUD, notes, follow-up queue, dashboard stats, access checks | `src/lib/leads.ts` |
| Phone | Digits normalize; PK `03…` → `92…` on write | `src/lib/phone.ts` |
| CSV export helpers | Formula-safe cell escape | `src/lib/csv.ts` |
| Ads Drop parse | CSV (papaparse) / XLSX (xlsx); size/row limits | `src/lib/import-parse.ts` |
| Ads Drop map | Header fingerprint, Meta defaults, mapping validation | `src/lib/import-map.ts` |
| Ads Drop jobs | Job CRUD, preview/commit txn, presets, authz redaction | `src/lib/imports.ts` |
| Types | Roles, stages, import statuses/outcomes | `src/lib/types.ts` |
| Seed | Wipe DB + demo owner/agent/leads | `scripts/seed.ts` |

## Data model

Schema from `src/lib/db.ts` (created/migrated on first `getDb()`):

### `users`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `email` | Unique |
| `password_hash` | bcrypt |
| `name` | Display name |
| `role` | `owner` \| `agent` |
| `created_at` | ISO-8601 |

### `leads`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `name`, `phone` | Required; phone stored normalized |
| `email`, `source` | Optional |
| `stage` | `new` \| `qualified` \| `follow_up` \| `won` \| `lost` |
| `owner_id` | FK → `users` |
| `value_cents` | Integer; default `0` |
| `currency` | Default `PKR` |
| `next_follow_up` | ISO datetime or null |
| `created_at`, `updated_at` | ISO-8601 |
| `meta_lead_id` | Ads Drop; unique when non-null |
| `meta_campaign` | Ads Drop campaign label |

Indexes: stage, owner, follow-up, phone, source, unique partial on `meta_lead_id`.

### `notes`

Append-only activity on a lead: `id`, `lead_id` (CASCADE), `user_id`, `body`, `created_at`. Max body length enforced in API (5000).

### `sessions`

| Column | Notes |
|--------|--------|
| `id` | Random UUID (cookie value) |
| `user_id` | FK → `users` CASCADE |
| `expires_at` | 14 days from create |

### Ads Drop tables

- **`import_jobs`** — upload metadata, headers/mapping/sample JSON, status (`uploaded` → `mapped` → `previewed` → `committing` → `done` \| `failed`), tallies, nudge/note-on-match flags.
- **`import_job_rows`** — per-row raw JSON, outcomes (`pending` \| `created` \| `duplicate_meta_id` \| `duplicate_phone` \| `invalid` \| `note_on_match` \| `error`), optional `lead_id`.
- **`import_mapping_presets`** — named mapping keyed by `header_fingerprint` (unique).

## Auth & access

- **Method:** Email + password; bcrypt cost 10.
- **Session:** Cookie `raabta_session` = random UUID stored in `sessions` (not HMAC-signed). `SESSION_SECRET` is reserved/unused in MVP.
- **Cookie:** `httpOnly`, `sameSite=lax`, `path=/`, `maxAge` 14 days. `Secure` from `COOKIE_SECURE` / `x-forwarded-proto` / `NODE_ENV` (see [CONFIGURATION.md](./CONFIGURATION.md)).
- **Register:** First user becomes `owner`; further public register returns 403 (agents via Team).
- **Authorization:**
  - Owner: all leads, CSV export, create agents, all import jobs.
  - Agent: own leads only (`owner_id === user.id`); own upload jobs; teammate list without emails.
  - Ads Drop: `note_on_match` only if agent can access the matched lead; otherwise `duplicate_phone`. Report/`lead_id` redacted when viewer cannot access that lead.

## Ads Drop import flow

1. **Upload** `POST /api/imports` — multipart `file` (≤ 5 MB, ≤ 2000 data rows; `.csv` / `.xlsx` / `.xls`).
2. **Map** `PATCH /api/imports/:jobId/mapping` — column → targets (`name`, `phone`, `email`, `meta_lead_id`, `meta_campaign`, `created_at`, `note`, `ignore`); optional `nudge_hours` ∈ `{0,2,4,24}` or null; optional preset save.
3. **Preview** `POST /api/imports/:jobId/preview` — tallies + sample outcomes (no writes).
4. **Commit** `POST /api/imports/:jobId/commit` with `{ "confirm": true }` — claims `committing`, evaluates + writes in one SQLite transaction; creates leads with `source=meta_ads`, stage `new`, import note; optional follow-up nudge.
5. **Report** UI + `GET /api/imports/:jobId/report.csv`.

Dedupe: Meta `meta_lead_id` first, then normalized phone. No live Meta API.

## Request flow

1. Browser hits a desk page or `fetch`es `/api/*` with session cookie.
2. Handler calls `requireUser()` / `requireOwner()` (or public auth endpoints).
3. Domain helpers use `getDb()` (singleton + migrate).
4. JSON `{ error: "…" }` on failure, or resource payloads / CSV attachment.
5. Selected routes log via `src/lib/logger.ts` (request id, route, duration, status — no secrets).

## Error handling & logging

- Errors: plain `{ "error": "<message>" }` with HTTP 400/401/403/404/409/500 as appropriate.
- Logs: structured request logs in auth/leads/imports paths; never log passwords or cookie values.
- Secrets: env-only; `.env.local` and `data/*.db*` gitignored.

## Non-goals / boundaries

- No Meta Marketing API, WhatsApp Business API, or webhooks
- No multi-tenant / multi-workspace DB
- No drag-and-drop Kanban (stage buttons only)
- No soft-delete / archive
- No signed session cookies yet (`SESSION_SECRET` unused)
