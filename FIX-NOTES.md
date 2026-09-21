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

## Ads Drop v0.2.0 (2026-09-21, Asia/Karachi)

**Goal:** Ship Raabta Ads Drop — Meta Lead Ads CSV/XLSX → Desk leads — per `BUILD-BRIEF-raabta-ads-drop.md` + `PRD-raabta-ads-drop.md`.

| Area | Change | Files |
|------|--------|-------|
| Schema | Idempotent `meta_lead_id` / `meta_campaign` on `leads` + indexes; tables `import_jobs`, `import_job_rows` (`raw_json` NOT NULL), `import_mapping_presets` | `src/lib/db.ts` |
| Domain | Parse CSV/XLSX; fingerprint + Meta defaults; preview/commit txn; lead meta helpers | `src/lib/import-parse.ts`, `import-map.ts`, `imports.ts`, `leads.ts`, `types.ts` |
| API | PRD §7 `/api/imports/**` + presets; authz owner vs agent | `src/app/api/imports/**` |
| UI | Nav **Ads Drop**; list/upload, map, preview, report; meta fields on lead detail | `Nav.tsx`, `(desk)/imports/**`, `LeadDetail.tsx` |
| Fixtures / tests | `fixtures/meta-leads-sample.csv` + `.xlsx`; vitest parse/map/commit/idempotency/authz | `fixtures/**`, `tests/imports.test.ts` |
| Deps | `papaparse@5.5.2`, `xlsx@0.18.5`, `@types/papaparse@5.3.15` — **no Meta SDK** | `package.json` |
| Docs | README Ads Drop; PRODUCT Ads Drop; STATUS feature complete; version **0.2.0** | `README.md`, `docs/PRODUCT.md`, `STATUS.md` |

**Verification:** `npm test` 27 passed; `npm run build` success.

## Ads Drop QA (2026-09-21)

| ID | Change | Files |
|----|--------|-------|
| **AD-01** | `findLeadByPhone` normalizes both query and stored phones via `preparePhoneForStorage`; seed Sana phone → `923007778899`. | `src/lib/leads.ts`, `scripts/seed.ts`, `tests/imports.test.ts` |
| **AD-02** | `nudge_hours` must be `null` or `{0,2,4,24}` else 400. | `src/lib/imports.ts` |
| **AD-03** | `first_name` + `last_name` both map to `name` when no full_name. | `src/lib/import-map.ts` |
| **AD-04** | Import write neutralizes leading `= + - @` on names (`sanitizeSpreadsheetText`). | `src/lib/imports.ts` |

## Ads Drop security M1/M2/M3 (2026-09-21, Asia/Karachi)

**Source:** `SECURITY-REPORT-ADS-DROP.md`. H1 (`xlsx` HIGH) left accepted / unchanged.

| ID | Change | Files |
|----|--------|-------|
| **M1** | `evaluateRows` takes `SessionUser`; `note_on_match` only when `canAccessLead(user, existing)`; else `duplicate_phone` (preview tallies match commit). | `src/lib/imports.ts` |
| **M2** | `serializeJobRow` redacts `lead_id` when viewer cannot access that lead; used by GET job rows + report CSV. Owners keep full ids. | `src/lib/imports.ts`, `src/app/api/imports/[jobId]/route.ts`, `report.csv/route.ts` |
| **M3** | Claim `committing` with `UPDATE … WHERE status NOT IN ('done','committing')` + `changes` check; run `evaluateRows` + writes inside one SQLite transaction. | `src/lib/imports.ts` |

**Tests:** agent foreign `note_on_match` → `duplicate_phone` / no note; agent job/report omits foreign `lead_id`.

**Docs:** GUIDE Ads Drop authz line; STATUS security fix note.

## v0.3.0 P0 + improve delta (2026-09-21, Asia/Karachi)

**Source:** Master P0 (soft-archive, empty-state, import cadence) + IMPROVE delta (WA chips, `/leads` filters, auth hygiene). P1 note templates + pipeline health strip also landed.

| Area | Change | Key files |
|------|--------|-----------|
| Soft-archive | `archived_at` via `ensureColumn`; hide by default; board `?archived=1`; PATCH `{archived}`; authz = `canAccessLead` (owner any / agent own) | `db.ts`, `leads.ts`, `LeadDetail.tsx`, `BoardArchiveToggle.tsx`, `board/page.tsx` |
| Onboarding | 3-step EN+RU checklist; dismiss per-user setting; sample lead CTA | `OnboardingChecklist.tsx`, `settings.ts`, `api/settings`, `api/leads/sample` |
| Import cadence | `import_remind_days` (default 3); banner from last `import_jobs.finished_at` | `ImportCadenceBanner.tsx`, `getDashboardStats`, dashboard |
| WA chips | `toWhatsAppUrl(phone, text?)`; chips on detail / follow-ups / leads list | `phone.ts`, `wa-chips.ts`, `WaMessageChips.tsx` |
| Leads list | `/leads` + Nav; `q`/stage/source/campaign/owner_id; agent scoped | `leads/page.tsx`, `listLeads`, `GET /api/leads` |
| Auth hygiene | rate limit Map ≤10/15m → 429; password min 10; `chmod 0600` | `rate-limit.ts`, login/register/users, `db.ts` |
| Docs | CHANGELOG / STATUS / GUIDE / README / DEPLOYMENT / FIX-NOTES | |

**Authz choice (archive):** Prefer owner; agents may archive **own** leads only (same as update). Documented in CHANGELOG.

**Verification:** `npm test` green; `npm run build` success; version **0.3.0**. No GitHub push.
