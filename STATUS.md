# Raabta Desk — STATUS

**Project ID:** `proj_raabta_desk_001`  
**Status:** ADS DROP SECURITY M1/M2/M3 FIXED
**Updated:** 2026-09-21T17:30:32+05:00 (Asia/Karachi)
**PRD:** `/workspace/factory/research/PRD-first-mvp.md` + `/workspace/factory/research/PRD-raabta-ads-drop.md`

## What works

- Next.js 15.5.25 + TypeScript + Tailwind + SQLite (`better-sqlite3`) at this path
- Auth: register (first user = owner), login, logout, httpOnly session cookies, bcrypt hashes
- Owner can create **agent** users only (Team page; API rejects role=owner)
- Leads CRUD + stage changes (`new | qualified | follow_up | won | lost`)
- Kanban board with stage buttons (mobile-friendly horizontal scroll)
- Follow-up queue (due today + overdue); Done / Tomorrow actions
- Append-only activity notes on lead detail (max 5000 chars)
- WhatsApp button → `https://wa.me/<digits>`
- Dashboard: stage counts, overdue, due today, open pipeline value (PKR)
- Owner CSV export (`/api/export/leads.csv`); agents get 403; formula-safe escaping
- Phone quality validation + PK `03…` → `92…` rewrite on write
- **Ads Drop (v0.2):** Meta CSV/XLSX upload → map → preview → commit; phone + `meta_lead_id` dedupe; import report; mapping presets; follow-up nudge; Nav **Ads Drop**; agent cannot note other owners’ leads via import; foreign `lead_id` redacted on agent reports
- Seed script + README + `docs/PRODUCT.md` + `.env.example`
- Tests: phone + smoke + API authz + imports — see `npm test`

## Ads Drop (2026-09-21)

Implemented 8 MVP features from `PRD-raabta-ads-drop.md` / `BUILD-BRIEF-raabta-ads-drop.md`. Details in `FIX-NOTES.md`.

- `npm test`: **27 passed**
- `npm run build`: **success**
- Version: **0.2.0**
- No Meta Marketing API / WABA SDKs

## How to run

```bash
cd /workspace/factory/projects/raabta-desk
npm install
npm run seed
npm run dev          # http://localhost:3000
# or production over plain HTTP locally:
# COOKIE_SECURE=false npm run build && COOKIE_SECURE=false npm run start
npm test
```

### Demo logins

| Role  | Email              | Password |
|-------|--------------------|----------|
| Owner | owner@raabta.local | owner123 |
| Agent | agent@raabta.local | agent123 |

## Manual QA checklist

- [x] Fresh seed boots with SQLite under `data/`
- [x] Two users share one DB (owner sees all; agent sees own)
- [x] Overdue / due-today queue correct
- [x] WhatsApp URL normalizes phone digits
- [x] CSV export works for owner only
- [x] Unit + smoke + API tests pass
- [x] README sufficient to run
- [x] QA-REPORT F1–F12 addressed
- [x] Ads Drop: upload → map → preview → commit (automated tests)
- [x] Ads Drop: re-upload same Meta ids → 0 new leads
- [x] Ads Drop: invalid phones skip; nudge sets follow-up

## Security H1 (2026-09-21)

Upgraded `next` **14.2.35 → 15.5.25** (matched `eslint-config-next@15.5.25`), direct `postcss@8.5.28` + overrides, optional `vitest@3.2.7`.

## Next

1. QA Bug Hunter: PRD §12 + brief §5 manual checklist
2. Publish when GitHub connected (do not push yet)

## Gaps / known limits

- No drag-and-drop (buttons only — acceptable for MVP)
- No soft-delete / archive
- No Urdu UI toggle (post-MVP)
- Agents cannot reassign lead ownership (owner can)
- `SESSION_SECRET` is **reserved / unused** in MVP (random UUID sessions in DB)
- For local HTTP production mode set `COOKIE_SECURE=false`; keep Secure for real HTTPS
- Ads Drop: no live Meta API / webhook; manual CSV re-download cadence

## Ads Drop QA

AD-01–AD-04 from `QA-REPORT-ADS-DROP.md` applied — details in `FIX-NOTES.md`.

## Ads Drop security (2026-09-21)

M1/M2/M3 from `SECURITY-REPORT-ADS-DROP.md` fixed (note_on_match authz, lead_id redact, commit race). H1 xlsx risk accepted / unchanged. Details in `FIX-NOTES.md`.
