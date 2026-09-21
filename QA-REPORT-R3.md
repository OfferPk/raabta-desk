# QA Report R3 — Raabta Desk MVP (R2-R1 re-verify + production smoke)

**Project:** `/workspace/factory/projects/raabta-desk`  
**Prior reports:** `QA-REPORT.md`, `QA-REPORT-R2.md`  
**Engineer notes:** `FIX-NOTES.md`  
**QA date:** 2026-09-21 (Asia/Karachi, PKT)  
**QA agent:** QA Bug Hunter (executor, R3)  
**Overall recommendation:** **READY**

---

## Summary

**R2-R1 is fixed.** `csvEscape` lives in `src/lib/csv.ts`; the App Router export route only exports `GET` and imports the helper. **`npm test` 18/18**, **`npm run build` succeeds**, and full smoke against **`next start`** on `:3000` (with `COOKIE_SECURE=false`) **PASS**.

F1–F12 remain accepted from R2 (all previously PASS); R3 spot-checked **F1** (empty PATCH → 400) and **F4** (CSV formula prefix).

| Bucket | Result |
|--------|--------|
| R2-R1 (`csvEscape` route export) | **PASS** |
| npm test | **18/18** |
| npm run build | **PASS** |
| Production smoke (`next start`) | **PASS** |
| New regressions | **0** |

---

## R2-R1 result

| Item | Result | Evidence |
|------|--------|----------|
| `src/lib/csv.ts` exists with `csvEscape` | **PASS** | File present; formula neutralization `^[=+\-@]` → prefix `'` |
| Route imports helper | **PASS** | `src/app/api/export/leads.csv/route.ts`: `import { csvEscape } from "@/lib/csv"` |
| Route does **not** export `csvEscape` | **PASS** | Only `export async function GET()` |
| Tests import from lib | **PASS** | `tests/api.test.ts` imports `@/lib/csv` |
| Production build | **PASS** | `npm run build` completes; `/api/export/leads.csv` listed in route table |

---

## Test results

Command: `cd /workspace/factory/projects/raabta-desk && npm test`

```
 RUN  v2.1.9 /workspace/factory/projects/raabta-desk

 ✓ tests/phone.test.ts (9 tests)
 ✓ tests/smoke.test.ts (3 tests)
 ✓ tests/api.test.ts (6 tests)

 Test Files  3 passed (3)
      Tests  18 passed (18)
```

---

## Build results

Command: `npm run build`

```
 ✓ Compiled successfully
 ✓ Linting and checking validity of types ...
 ✓ Generating static pages (19/19)
```

Next.js 14.2.35 production build **exit 0**. Invalid Route export error from R2 is **gone**.

---

## Smoke results checklist

Environment: `COOKIE_SECURE=false` (`.env.local` + process env); server **`next start -p 3000`** (production) after fresh build. Demo logins: `owner@raabta.local` / `owner123`, `agent@raabta.local` / `agent123`.

| Check | Result | Evidence |
|-------|--------|----------|
| App responds on :3000 | **PASS** | `GET /` → **307** → `/login` |
| Login owner | **PASS** | `POST /api/auth/login` → **200** + `raabta_session` HttpOnly; SameSite=lax; **no** `Secure` |
| Login agent | **PASS** | Same (**200**) |
| Leads list owner / agent scope | **PASS** | Owner list larger; agent scoped to own leads |
| Lead create | **PASS** | Owner/agent `POST /api/leads` → **201** |
| Stage change | **PASS** | `PATCH stage=qualified` → **200**; invalid → **400** `Invalid stage` |
| Follow-up Done / Tomorrow | **PASS** | `next_follow_up` **null** / `2026-09-22T10:00:00.000Z` |
| Notes append | **PASS** | `POST .../notes` → **201** |
| `wa.me` link | **PASS** | Lead HTML `https://wa.me/923007778899` |
| CSV owner | **PASS** | **200** `text/csv` |
| CSV agent | **PASS** | **403** `Forbidden — owners only` |
| CSV anon | **PASS** | **401** `Unauthorized` |
| Agent IDOR GET/PATCH/DELETE/notes | **PASS** | All **403** `Forbidden` |
| F1 empty PATCH | **PASS** | `{"name":""}` / `{"phone":"  "}` → **400** `Name and phone are required` |
| F4 formula prefix in CSV | **PASS** | Export cell `,'=CMD\|'/c calc'!A1,` |

---

## New issues

**None.** No new functional or build regressions observed in R3.

---

## Residual risks / F1–F12 status note

- **F1–F12:** All **PASS** in R2 (`QA-REPORT-R2.md`). R3 did not re-run the full F-matrix; spot-checked **F1** and **F4** on production — both still PASS.
- **F2:** Confirmed under `next start` + `COOKIE_SECURE=false`: session cookie has HttpOnly + SameSite=lax and **no** Secure flag even with `NODE_ENV=production`.
- Residual risks from R2 (e.g. `SESSION_SECRET` unused/HMAC not wired, SQLite single-node, demo seed creds) unchanged and acceptable for MVP local/demo ship.
- Do **not** set `COOKIE_SECURE=true` behind plain HTTP; use HTTPS or keep `COOKIE_SECURE=false` for local.

---

## Recommendation

**READY** to ship MVP locally / demo: R2-R1 fixed, tests green, production build green, production smoke green. No open High blockers.
