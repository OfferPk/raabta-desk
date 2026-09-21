# QA Report R2 — Raabta Desk MVP (re-verify F1–F12)

**Project:** `/workspace/factory/projects/raabta-desk`  
**Prior report:** `QA-REPORT.md`  
**Engineer notes:** `FIX-NOTES.md`  
**QA date:** 2026-09-21 (Asia/Karachi, PKT)  
**QA agent:** QA Bug Hunter (executor, R2)  
**Overall recommendation:** **NEEDS FIXES**

---

## Summary

All **12** prior findings (**F1–F12**) are **functionally fixed** and re-verified with curl + cookies and vitest. Automated tests: **18/18 pass**. Core smoke (auth, leads CRUD/stages/follow-ups/notes, `wa.me`, CSV role gates, agent IDOR) still **PASS**.

**Ship blocker (new regression):** `npm run build` fails because `csvEscape` is exported from `src/app/api/export/leads.csv/route.ts`. Next.js route modules may only export HTTP handlers; this breaks production `next start`. R2 smoke used `next dev` after the failed rebuild wiped `.next`. Fix by moving `csvEscape` to e.g. `src/lib/csv.ts` and importing it from the route + `tests/api.test.ts`.

| Bucket | Result |
|--------|--------|
| F1–F12 re-verify | **12 PASS / 0 FAIL** |
| npm test | **18/18** |
| Smoke checklist | PASS (via `next dev`) |
| New regressions | **1 High** — production build broken (`csvEscape` route export) |

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

F7 coverage present in `tests/api.test.ts`: agent 403 foreign lead + export; owner 200 export; empty PATCH name 400; short phone 400; `csvEscape` formula prefix.

---

## Smoke results checklist

Environment: `COOKIE_SECURE=false` in `.env.local`; server restarted as **`next dev -p 3000`** after `next build` failed (see regressions). Demo logins: `owner@raabta.local` / `owner123`, `agent@raabta.local` / `agent123`.

| Check | Result | Evidence |
|-------|--------|----------|
| App responds on :3000 | PASS | `GET /` → 307 (dev) |
| Login owner | PASS | `POST /api/auth/login` → 200 + `raabta_session` HttpOnly; **no** `Secure` |
| Login agent | PASS | Same |
| Leads list owner / agent scope | PASS | Owner count 6+; agent count 3 (own only) |
| Lead create | PASS | Agent/owner creates → 201 |
| Stage change | PASS | `PATCH stage=qualified` → 200; invalid → 400 |
| Follow-up Done / Tomorrow | PASS | `next_follow_up` null / `2026-09-22T10:00:00.000Z` |
| Notes append | PASS | `POST .../notes` → 201 |
| `wa.me` link | PASS | Lead HTML `https://wa.me/923007778899` |
| CSV owner | PASS | **200** |
| CSV agent | PASS | **403** `Forbidden — owners only` |
| CSV anon | PASS | **401** |
| Agent IDOR GET/PATCH/DELETE/notes | PASS | All **403** |

---

## F1–F12 re-verify table

| F-id | Severity | Title | R2 result | Evidence |
|------|----------|-------|-----------|----------|
| F1 | High | PATCH empty name/phone → 400 | **PASS** | `PATCH` `{"name":""}` / `{"phone":"  "}` → **400** `{"error":"Name and phone are required"}` |
| F2 | High | Secure cookie gated (`COOKIE_SECURE` / docs) | **PASS** | `.env.local` `COOKIE_SECURE=false`; login `Set-Cookie` has HttpOnly+SameSite=lax, **no Secure**; README/`.env.example` document gate; logic: false→off, true→on, x-forwarded-proto https→on |
| F3 | Medium | Short/invalid phone create/PATCH → 400 | **PASS** | `POST` `"phone":"123"` / `PATCH` `"12"` → **400** `Valid phone with country code required (e.g. 923001234567)` |
| F4 | Medium | CSV formula injection prefixed with `'` | **PASS** | Lead name `=CMD\|'/c calc'!A1`; export line: `,'=CMD\|'/c calc'!A1,` |
| F5 | Medium | POST `/api/users` role=owner rejected; Team UI no Owner | **PASS** | `role":"owner"` → **400** `Only agent role can be created via Team`; `/users` UI “Add agent”, hardcoded `role: "agent"`, no Owner `<option>` |
| F6 | Medium | Bad `owner_id` → 400 not 500 | **PASS** | `owner_id` nil UUID → **400** `{"error":"Invalid owner_id"}` |
| F7 | Medium | New API tests exist and pass | **PASS** | `tests/api.test.ts` (6 tests) included in **18/18** green run |
| F8 | Low | Negative value clamped | **PASS** | `POST` `"value":-5000` → `value_cents`: **0**; PATCH `-100` → **0** |
| F9 | Low | Agent GET `/users` omits emails | **PASS** | Agent: users `[{id,name,role},…]` (no email); owner still gets emails |
| F10 | Low | `SESSION_SECRET` clarified | **PASS** | README/STATUS/`.env.example`: **reserved / unused in MVP** |
| F11 | Low | Huge note body → 400 | **PASS** | 5001 chars → **400** `at most 5000 characters`; 5000 chars → **201** |
| F12 | Low | PK `03…` phone normalized | **PASS** | `POST` `"phone":"03001234567"` → stored `"923001234567"` **201** |

**Pass/fail count: 12 PASS / 0 FAIL**

---

## New regressions

| ID | Severity | Title | Evidence | Fix request |
|----|----------|-------|----------|-------------|
| **R2-R1** | **High** | `next build` fails: `csvEscape` exported from App Router route | `npm run build` → Type error: `"csvEscape" is not a valid Route export field` on `src/app/api/export/leads.csv/route.ts` | Move `csvEscape` to `src/lib/csv.ts` (or similar); import from route + `tests/api.test.ts`; keep only `GET` exported from the route file. Re-run `npm run build && COOKIE_SECURE=false npm start`. |

No other functional regressions observed in smoke vs R1.

---

## Residual risks

- Production path untested in R2 (`next start`) until R2-R1 is fixed; behavior was verified under `next dev` + vitest route handlers.
- Formula-safe CSV uses leading `'`; Excel may still show the apostrophe — acceptable for MVP.
- Sessions remain unsigned UUID cookies (`SESSION_SECRET` unused by design).
- Agents still see all user id/name/role (emails omitted) — intentional for assignment UI.

---

## Recommendation

**NEEDS FIXES** — not READY, not BLOCKED on product logic.

Clear **R2-R1** (relocate `csvEscape`), rebuild, and optionally re-smoke once under `next start`. F1–F12 need no further code changes.

**Do not push to GitHub** (per brief).
