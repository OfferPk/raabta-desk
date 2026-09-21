# Raabta Desk — STATUS

**Project ID:** `proj_raabta_desk_001`  
**Status:** v0.3.0 P0 + delta improve (archive, onboarding, cadence, WA chips, leads list, auth hygiene)  
**Updated:** 2026-09-21T18:20:00+05:00 (Asia/Karachi)  
**PRD:** `/workspace/factory/research/PRD-first-mvp.md` + `/workspace/factory/research/PRD-raabta-ads-drop.md`  
**Improve:** `/workspace/factory/inbox/IMPROVE-raabta-desk-20260921-1815.md` + delta

## What works

- Next.js 15.5.25 + TypeScript + Tailwind + SQLite (`better-sqlite3`)
- Auth: register (first = owner), login, logout; bcrypt; httpOnly sessions; **login/register rate limit (429)**; password min **10**
- Owner Team page creates agents; CSV export owner-only
- Leads CRUD + stages; **soft-archive** (hide from board/queue; Show archived toggle)
- **Leads list** `/leads` — search + stage/source/campaign/owner filters (agents scoped to self)
- Kanban board + follow-up queue; notes + **quick templates**
- WhatsApp `wa.me` + **prefill chips** (EN + Roman Urdu)
- Dashboard: counts, overdue, pipeline value, **pipeline health strip**, **import cadence banner**, empty-state **onboarding checklist**
- **Ads Drop (v0.2):** Meta CSV/XLSX import map/preview/commit
- DB file mode **0600** after open when supported
- Tests: phone + smoke + API + imports + v0.3 archive/settings + leads filters + auth hygiene — `npm test`
- Version: **0.3.0**
- Branch: `feature/v0.3-improve` @ `23b5b27` (+ docs follow-up)
- `npm test`: **50 passed**; `npm run build`: **success** (no push)

## How to run

```bash
cd /workspace/factory/projects/raabta-desk
npm install
npm run seed
npm run dev          # http://localhost:3000
npm test
npm run build
```

### Demo logins

| Role  | Email              | Password |
|-------|--------------------|----------|
| Owner | owner@raabta.local | owner123 |
| Agent | agent@raabta.local | agent123 |

## Gaps / known limits

- No drag-and-drop Kanban
- No Urdu UI toggle / dark mode
- No live Meta Marketing API / WABA
- Rate limit is in-memory (single-node MVP)
- Demo seed passwords remain short (local only); new register/Team enforce min 10

## Next

1. QA on archive + empty-state + cadence + `/leads` + WA chips
2. Publish when approved (do not push yet)
