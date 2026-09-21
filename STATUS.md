# Raabta Desk — STATUS

**Project ID:** `proj_raabta_desk_001`  
**Status:** H1 SECURITY UPGRADE (next 15.5.25)
**Updated:** 2026-09-21T17:00:31+05:00 (Asia/Karachi)
**PRD:** `/workspace/factory/research/PRD-first-mvp.md`

## What works

- Next.js 15.5.25 + TypeScript + Tailwind + SQLite (`better-sqlite3`) MVP at this path
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
- Seed script + README + `docs/PRODUCT.md` + `.env.example`
- Tests: phone + smoke + API authz/validation — see `npm test`

## QA fixes (2026-09-21)

Implemented F1–F12 from `QA-REPORT.md` — details in `FIX-NOTES.md`.

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

## Security H1 (2026-09-21)

Upgraded `next` **14.2.35 → 15.5.25** (matched `eslint-config-next@15.5.25`), direct `postcss@8.5.28` + overrides, optional `vitest@3.2.7`.

- `npm test`: **18 passed**
- `npm run build`: **success**
- `npm audit` after: **0 critical / 0 high / 2 moderate / 0 low** (remaining: vitest / `@vitest/mocker` GHSA-82fw-gwwq-j7x9 — needs vitest ≥4.1.11 / 5.x; left on 3.x per task)
- Details: `FIX-NOTES.md` H1

## Next

1. Re-QA / Master review
2. Publish when GitHub connected (do not push yet)

## Gaps / known limits

- No drag-and-drop (buttons only — acceptable for MVP)
- No soft-delete / archive
- No Urdu UI toggle (post-MVP)
- Agents cannot reassign lead ownership (owner can)
- `SESSION_SECRET` is **reserved / unused** in MVP (random UUID sessions in DB)
- For local HTTP production mode set `COOKIE_SECURE=false`; keep Secure for real HTTPS
