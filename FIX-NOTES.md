# FIX-NOTES — Raabta Desk QA fixes

**Date:** 2026-09-21 (Asia/Karachi)  
**Source:** `QA-REPORT.md`  
**Scope:** F1–F12

| ID | Change | Files |
|----|--------|-------|
| **F1** | PATCH rejects empty `name` / `phone` after trim with 400 `"Name and phone are required"`. | `src/app/api/leads/[id]/route.ts` |
| **F2** | Session cookie `Secure` gated by `COOKIE_SECURE` env, else `x-forwarded-proto === https`, else `NODE_ENV === production`. Documented `COOKIE_SECURE=false` for local HTTP. Login/logout/register pass request headers. | `src/lib/auth.ts`, `src/app/api/auth/login/route.ts`, `logout/route.ts`, `register/route.ts`, `.env.example`, `README.md` |
| **F3** | Create + PATCH require `preparePhoneForStorage(phone)` non-null; 400 with country-code hint (`92300…`). | `src/lib/phone.ts`, `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts` |
| **F4** | CSV cells starting with `= + - @` prefixed with `'` before export. | `src/app/api/export/leads.csv/route.ts` |
| **F5** | `POST /api/users` forces `role=agent`; rejects `role=owner` with 400. Team UI role select removed (always agent). | `src/app/api/users/route.ts`, `src/app/(desk)/users/page.tsx` |
| **F6** | Before insert/update with `owner_id`, `SELECT id FROM users`; missing → 400 `"Invalid owner_id"`. | `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts` |
| **F7** | Vitest API tests: agent 403 foreign lead + export; owner 200 export; empty PATCH name 400; short phone 400; csvEscape formula check. | `tests/api.test.ts` |
| **F8** | `value_cents` clamped with `Math.max(0, …)` on create/PATCH. | `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/route.ts` |
| **F9** | `GET /api/users` for non-owners returns `{id,name,role}` only (omit email). | `src/app/api/users/route.ts` |
| **F10** | Documented `SESSION_SECRET` as reserved/unused for MVP (no HMAC wiring). | `README.md`, `STATUS.md`, `.env.example` |
| **F11** | Note body longer than 5000 chars → 400. | `src/app/api/leads/[id]/notes/route.ts` |
| **F12** | On create/update, digits matching `03` + 11 auto-rewrite to `92`+rest via `preparePhoneForStorage`; still validated. | `src/lib/phone.ts`, leads create/PATCH routes, `tests/phone.test.ts` |

## Status / docs

- `STATUS.md` → **QA FIXES APPLIED**
- `FIX-NOTES.md` (this file)
- No git push / remotes / CloudAgent

## R2 regression (2026-09-21)

| ID | Change | Files |
|----|--------|-------|
| **R2-R1** | Moved `csvEscape` out of App Router route (invalid Next.js export) into `src/lib/csv.ts`; route only exports `GET`; tests import from `@/lib/csv`. | `src/lib/csv.ts`, `src/app/api/export/leads.csv/route.ts`, `tests/api.test.ts` |

## Security H1 (2026-09-21, Asia/Karachi)

**Goal:** Clear npm audit critical/high on `next@14.2.35` by upgrading to latest 15.5.x.

| Item | Before | After |
|------|--------|-------|
| `next` | 14.2.35 | **15.5.25** |
| `eslint-config-next` | 14.2.35 | **15.5.25** |
| `postcss` (direct + override) | ^8 | **8.5.28** (overrides wipe nested next postcss) |
| `react` / `react-dom` | ^18 | **18.3.1** (kept React 18) |
| `vitest` | ^2.1.9 | **3.2.7** (clears vitest critical <3.2.6; not jumped to 5) |

### Audit summary

| Severity | Before | After |
|----------|--------|-------|
| critical | 2 (`next`, `vitest`) | **0** |
| high | 5 | **0** |
| moderate | 3 | **2** (`vitest`, `@vitest/mocker` — GHSA-82fw-gwwq-j7x9; fix needs vitest ≥4.1.11 / 5.x) |
| low | 0 | **0** |

### Code migrations (Next 15)

| Change | Files |
|--------|-------|
| `await cookies()`; auth helpers async | `src/lib/auth.ts`, logout/login/register/me, all `requireUser`/`requireOwner`/`getSessionUser` callers (desk pages + API routes) |
| Dynamic `params: Promise<{ id }>` + await | `src/app/api/leads/[id]/route.ts`, `notes/route.ts`, `src/app/(desk)/leads/[id]/page.tsx` |
| `experimental.serverComponentsExternalPackages` → `serverExternalPackages` | `next.config.mjs` |
| Tests: async cookies mock + `Promise.resolve(params)` | `tests/api.test.ts` |
| Next build auto-set `tsconfig` `target: ES2017` | `tsconfig.json` |

### Verification

- `npm test` — 18 passed
- `npm run build` — success (Next.js 15.5.25)
- No git push / remotes
