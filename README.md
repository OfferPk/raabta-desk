# Raabta Desk

WhatsApp-first shared lead & follow-up desk for SMB teams (especially Pakistan). Capture leads, move them on a simple Kanban pipeline, log notes, track follow-ups, and open chats via `wa.me` — **no Meta Cloud API, no paid APIs**.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- SQLite via `better-sqlite3` (file under `data/`)
- bcryptjs password hashes + httpOnly session cookies

## Quick start

```bash
cd /workspace/factory/projects/raabta-desk
cp .env.example .env.local   # optional — defaults work for local
npm install
npm run seed                 # creates demo owner + agent + leads
npm run dev                  # http://localhost:3000
```

### Demo logins (after seed)

| Role  | Email               | Password  |
|-------|---------------------|-----------|
| Owner | owner@raabta.local  | owner123  |
| Agent | agent@raabta.local  | agent123  |

Owner can export CSV and create agent users under **Team**.

## Scripts

| Command        | Description                          |
|----------------|--------------------------------------|
| `npm run dev`  | Start Next.js dev server             |
| `npm run build`| Production build                     |
| `npm run start`| Start production server              |
| `npm run seed` | Reset DB and load demo data          |
| `npm test`     | Phone + smoke + API authz/validation |
| `npm run db:reset` | Delete DB file and re-seed       |

## Environment

See `.env.example`:

- `DATABASE_PATH` — SQLite file path (default `./data/raabta.db`)
- `SESSION_SECRET` — **reserved / unused in MVP** (sessions are random UUIDs stored in SQLite; secret kept for a future signed-cookie upgrade)
- `COOKIE_SECURE` — controls the session cookie `Secure` flag:
  - `COOKIE_SECURE=false` — **use this for local HTTP** (`npm run build && npm start` on `http://localhost:3000`); otherwise browsers drop the cookie when `NODE_ENV=production`
  - `COOKIE_SECURE=true` — force Secure (recommended behind real HTTPS)
  - unset — Secure when `NODE_ENV=production`, or when the request has `x-forwarded-proto: https`

`data/*.db` is gitignored. Do not commit secrets.

## Features (MVP)

1. Register / login / logout (first user = owner)
2. Owner creates agent users
3. Leads CRUD with stages: `new | qualified | follow_up | won | lost`
4. Kanban board with stage buttons
5. Follow-up queue (due today + overdue)
6. Append-only activity notes (max 5000 chars)
7. WhatsApp button → `https://wa.me/<digits>`
8. Dashboard counts + open pipeline value (PKR)
9. Owner CSV export at `/api/export/leads.csv`
10. **Ads Drop** — Meta CSV/XLSX import with map/preview/commit, dedupe, presets, nudge


## Ads Drop (v0.2)

Upload a **Meta Lead Ads / Instant Forms** CSV or XLSX → map columns → preview → commit into the shared desk.

1. Open **Ads Drop** in the nav (`/imports`)
2. Upload an Ads Manager leads export (max 5 MB / 2,000 rows)
3. Confirm column mapping (smart defaults for `id`, `phone_number`, `full_name`, `campaign_name`, …)
4. Preview tallies → **Commit import**
5. Created leads get `source=meta_ads`, stage `new`, optional follow-up nudge, and an import note
6. Re-uploading the same Meta `id`s creates **0** new leads (dedupe)

No Meta App credentials or Marketing API — file upload only. Sample fixture: `fixtures/meta-leads-sample.csv`.

## Docs

- Product guide: [`docs/PRODUCT.md`](docs/PRODUCT.md)
- PRD: `/workspace/factory/research/PRD-first-mvp.md`

## Notes

- Use phone numbers with country code (e.g. `923001234567`) for correct WhatsApp links. Local PK `03XXXXXXXXX` is auto-rewritten to `92…` on create/update.
- Single-tenant: one SQLite DB = one business.
- Original implementation — not derived from other CRM codebases.

## License

MIT — see [LICENSE](LICENSE).

## Roman Urdu guide

Poora step-by-step (download, run, features): **[GUIDE-roman-urdu.md](./GUIDE-roman-urdu.md)**
