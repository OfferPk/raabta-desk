# Security Review — Raabta Ads Drop (Desk v0.2)

| Field | Value |
|-------|-------|
| **Project** | `/workspace/factory/projects/raabta-desk` |
| **Branch** | `feature/ads-drop` (not pushed) |
| **Date** | 2026-09-21 17:25 PKT (Asia/Karachi) |
| **Reviewer** | Security Reviewer (executor) |
| **Scope** | Ads Drop import surface + regression of prior `SECURITY-REPORT.md` controls. Report only — **no application source changes**, **no GitHub push**. |
| **Prior context** | `QA-REPORT-ADS-DROP-R2.md` (READY), `FIX-NOTES.md` (AD-01–AD-04 + Security H1 Next upgrade), `SECURITY-REPORT.md` (PASS_WITH_NOTES), `PRD-raabta-ads-drop.md` |
| **Overall verdict** | **PASS_WITH_NOTES** |

---

## Executive summary

Ads Drop’s application-layer authz for import **jobs** is sound and matches the PRD: unauthenticated → 401; agents scoped to own uploads (`canAccessJob`); agent `default_owner_id` forced to self; commit is transactional with `confirm: true` and 409 on re-commit; uploads land in SQLite (`raw_json`) not the filesystem (no path-traversal write); CSV/XLSX size/row caps exist; formula neutralization is applied on **import name** and on **report/lead CSV export**; no Meta Marketing API tokens or hard-coded cloud keys in `src` / fixtures; prior Next.js critical/high audit (H1) is **cleared** via `next@15.5.25`.

Residual risks that keep this from a clean **PASS**:

1. **`xlsx@0.18.5` has HIGH advisories with no fix** (`npm audit --omit=dev`) — prototype pollution + ReDoS (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9). RELEASE_GATE still needs Olivia acceptance or a parser change before internet-facing deploy.
2. **`note_on_match` bypasses `canAccessLead`** — agents can append notes (and learn `lead_id`) for other owners’ leads via phone match, unlike `POST /api/leads/:id/notes`.
3. Hardening gaps: extension-only file typing (no magic-byte/MIME check); incomplete formula sanitization on non-name fields at import write; commit evaluation outside the SQLite transaction (phone-dupe race under concurrency); shared presets deletable/overwritable by any authenticated user (PRD-intended workspace share, but no creator check).

**Sign-off for merge/publish of Ads Drop:** **Yes, with notes** — merge to product tree / prepare publish is acceptable for local/demo MVP if Olivia **accepts xlsx HIGH** (or drops/replaces XLSX parsing) and treats `note_on_match` cross-owner write as accepted single-tenant behavior **or** schedules a scoped fix. **Not** production-hardening sign-off. **Push: not performed.**

---

## Checklist (focus areas)

| # | Area | Result | Evidence summary |
|---|------|--------|------------------|
| 1 | **Upload** — type/size, path traversal, storage, content-type, temp cleanup | **PASS_WITH_NOTES** | Size 5 MB + 2000 rows (`src/lib/import-parse.ts` L4–5, L52–55, L102–105). Extension allowlist `.csv`/`.xlsx`/`.xls` (L106–113) — **no** MIME/magic-byte check. Filename stored as metadata only (`src/lib/imports.ts` L142–157); rows in SQLite `import_job_rows.raw_json` — **no disk upload path** → path traversal N/A; no temp files to clean. |
| 2 | **Mapping** — API authz, injection via columns/values | **PASS** | `updateMapping` → `canAccessJob` + 403 (`imports.ts` L373–375). Map targets allowlisted via `isValidMapTarget` / `MAP_TARGETS` (`mapping/route.ts` L23–30; `import-map.ts` L139–141). Headers/values persisted as JSON params — parameterized SQL, not concatenated into queries. |
| 3 | **Dedupe** — logic safety, no authz bypass via dedupe paths | **PASS_WITH_NOTES** | Order: invalid phone → `meta_lead_id` → phone (`imports.ts` L298–316); both-side phone normalize (AD-01, `leads.ts` L56–69). Unique index on `meta_lead_id` (`db.ts` L102–103). **Note:** `note_on_match` path writes notes without `canAccessLead` (see M1); report exposes foreign `lead_id` (see M2). Dedupe itself does not grant lead GET/PATCH. |
| 4 | **Commit** — who can commit; transactional safety; privilege escalation | **PASS_WITH_NOTES** | `requireUser` + `canAccessJob`; agent owner forced (`imports.ts` L514–515, L384–386). `confirm` required (L499); status `done` → 409 (L503–504). Lead creates + row updates inside `db.transaction` (L541–661). **Gap:** `evaluateRows` runs **before** the transaction (L524–525); status `committing` set outside txn (L520–522) — concurrent commits can double-create on phone-only rows (no unique phone index). |
| 5 | **Presets** — CRUD authz, IDOR on preset IDs | **PASS_WITH_NOTES** | PRD: workspace-shared manage for owner **and** agent. `listPresets` / `createPreset` / `deletePreset` require auth only; `DELETE` has **no** `created_by` check (`presets/[id]/route.ts` L13–17; `imports.ts` L757–762). Upsert-by-fingerprint overwrites any user’s preset (`upsertPreset` L703–715). Acceptable for single-tenant shared presets; residual IDOR if multi-tenant ever assumed. |
| 6 | **Nudge** | **PASS** | `nudge_hours` allowlist `{0,2,4,24}` or null (AD-02, `imports.ts` L395–405). Only applied to **created** leads as `next_follow_up` (L593–597) — no notification channel, no external send, no privilege escalation. |
| 7 | **Authz owner vs agent** — import/upload/commit/presets; IDOR on job IDs | **PASS_WITH_NOTES** | Jobs: list filter (`route.ts` L17–19); GET/mapping/preview/commit/report use `canAccessJob` (403). Agent cannot assign other owners. Presets shared by design. **Job IDOR: PASS.** Cross-owner note via import: **fail-open** vs Desk note API (M1). |
| 8 | **CSV/XLSX parsing** — proto pollution, zip/xlsx bombs, formulas, malicious XML | **FAIL → noted (dep)** | `papaparse@5.5.2` + `xlsx@0.18.5`. Audit: **1 high** on `xlsx` (proto pollution + ReDoS). Byte cap before parse helps; **no** explicit decompression/cell-density bomb guard beyond row cap after parse. `dynamicTyping: false` / `raw: false` reduce type surprises. Formula cells become strings then may hit sanitize only on name. |
| 9 | **Formula sanitization** — import **and** re-export | **PASS_WITH_NOTES** | Import: `sanitizeSpreadsheetText` on **name** only (`imports.ts` L182–187, L285; AD-04). Export: `csvEscape` on import report (`report.csv/route.ts` L41–46) and owner leads export (`export/leads.csv/route.ts`). **Gap:** email / `meta_campaign` / note bodies not neutralized at import write (export still prefixes `=+-@`). |
| 10 | **No Meta API secrets** | **PASS** | No Meta SDK in `package.json`. Grep `src`+`fixtures`: no `access_token` / `app_secret` / `AKIA` / `sk-` / Graph tokens — only schema field names (`meta_lead_id`, etc.) and sample PII fixtures. |
| 11 | **Regression** — prior SECURITY-REPORT controls | **PASS** | Sessions still httpOnly + SameSite=lax (`auth.ts`). Lead IDOR: `canAccessLead` on notes/lead routes. Secrets: `.gitignore` covers `.env*`, `*.db*`; `git status --ignored` shows `.env.local` + `data/raabta.db*` ignored. Prior **H1 Next critical/high cleared** (`next@15.5.25`). CSV export still owner-only + `csvEscape`. |

---

## Findings

| ID | Severity | Title | Evidence | Risk | Remediation |
|----|----------|-------|----------|------|-------------|
| **H1** | **HIGH** | `xlsx` dependency HIGH CVEs (no fix on npm) | `package.json` L22 `xlsx@0.18.5`; `npm audit --omit=dev` → 1 high: GHSA-4r6h-8v6p-xvw6 (prototype pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS). Prior Next H1 resolved. | Malicious `.xlsx` upload (any authenticated user) may trigger parser vulnerabilities / DoS. Blocks clean RELEASE_GATE audit. | Prefer CSV-only for MVP **or** replace with a maintained parser (e.g. well-supported alternative) / SheetJS Pro if licensed; keep 5 MB + row caps; document **Olivia risk acceptance** for local/demo if XLSX must ship. Re-run `npm audit --omit=dev` after change. |
| **M1** | **MEDIUM** | `note_on_match` bypasses lead authz | `commitJob` → `addNote(e.existing_lead_id, …)` (`imports.ts` L574–577) with **no** `canAccessLead`. Contrast: `POST /api/leads/[id]/notes` enforces it (`notes/route.ts`). `findLeadByPhone` scans **all** leads (`leads.ts` L56–69). | Agent can append arbitrary import-note content to another owner’s lead (and bump `updated_at`) by uploading a matching phone — privilege not available via normal Notes API. | On `note_on_match`, only append if `canAccessLead(user, existing)`; else treat as `duplicate_phone`. Optionally restrict `note_on_match` to owners. |
| **M2** | **MEDIUM** | Import report leaks foreign `lead_id` on dupe/match | `updateRow` stores `e.existing_lead_id` for dupe/note outcomes (`imports.ts` L559–587); GET job / report CSV return `lead_id` (`[jobId]/route.ts` L37–46; `report.csv/route.ts`). | Agent learns UUIDs of leads they cannot open (403 on lead GET) — aids probing / social engineering. | Omit `lead_id` in agent responses when `!canAccessLead`; or redaction on report for non-owners. |
| **M3** | **MEDIUM** | Commit race: eval outside transaction; no unique phone | `evaluateRows` at L524–525 before `db.transaction` (L541); phone has index but **not** UNIQUE (`db.ts` L104). Concurrent double-commit on same job can create two leads for same phone when `meta_lead_id` absent. | Rare under SQLite single-writer but possible with parallel requests; pollutes desk with phone dupes. | Move eval+writes inside one transaction; set status `committing` with `WHERE status NOT IN ('done','committing')` and check `changes`; consider unique normalized phone or stronger idempotency key. |
| **L1** | **LOW** | Extension-only type check (no MIME / magic bytes) | `parseImportFile` uses `filename.toLowerCase().endsWith(...)` only (`import-parse.ts` L106–113). Upload route does not read `file.type` (`api/imports/route.ts` L47–53). | Polyglot / mislabeled files still parsed if extension matches; low impact given parsers + size caps. | Optionally require `file.type` allowlist **and** sniff ZIP/`PK` for xlsx / text for csv; reject mismatch. |
| **L2** | **LOW** | Formula sanitize incomplete on import write | Only `name` uses `sanitizeSpreadsheetText` (`imports.ts` L285). `email`, `meta_campaign`, note bodies stored raw. Re-export paths use `csvEscape` (good). | Formula-like email/campaign survive in DB; risk mainly if copied unsafely outside export helpers. | Apply `sanitizeSpreadsheetText` (or shared helper) to email, campaign, and note lines on write. |
| **L3** | **LOW** | Shared preset delete/overwrite without creator check | `deletePreset(id)` deletes by id only (`imports.ts` L757–762). `upsertPreset` overwrites by fingerprint (`L703–715`). | Any agent can delete/replace workspace presets (PRD allows shared manage). Disruptive in multi-agent orgs, not cross-tenant. | Optional: owner-only DELETE, or `created_by === user \|\| role===owner`; audit log. |
| **I1** | **INFO** | Upload not written to disk (positive) | Buffer → parse → SQLite only (`route.ts` L48–66; `createImportJob`). | N/A — reduces path-traversal / leftover-temp risk. | Keep; avoid introducing `/tmp` file drops without randomized names + cleanup. |
| **I2** | **INFO** | Prior Next.js audit H1 cleared | `next@15.5.25` / `eslint-config-next@15.5.25` (`package.json`); audit critical=0. | Supply-chain gate improved vs `SECURITY-REPORT.md` H1. | Maintain patched Next on future bumps. |
| **I3** | **INFO** | Residual from base report still apply | Login rate limit absent; DB mode `644`; password min 6; CSRF = SameSite only; demo creds in seed/README. | Same as prior PASS_WITH_NOTES hardening debt. | Address before public internet deploy (see prior report M1–M4). |

### Positive controls (no finding)

- Unauthenticated import APIs → 401 (tests + `requireUser`).
- Agent foreign job → 403 (`canAccessJob`; vitest + QA-R2).
- Agent cannot set `default_owner_id` to another user.
- Commit requires `confirm: true`; second commit → 409.
- Parameterized SQL for jobs/rows/presets/leads.
- Import notes truncated to 5000 chars (`NOTE_MAX`).
- No `dangerouslySetInnerHTML` introduced for Ads Drop UI (React text for filenames/names).
- Fixtures are sample lead CSVs/XLSX only — no secrets.
- `.env.local` / `data/*.db*` remain gitignored.

---

## RELEASE_GATE mapping (Ads Drop delta)

| Gate item | Status |
|-----------|--------|
| Secrets only via env; no Meta tokens in tree | Met |
| Authz on privileged import actions | Met for jobs; **notes-on-match exception (M1)** |
| Validation + parameterized queries | Met |
| Dependency audit clean critical/high **or Olivia acceptance** | **Needs acceptance (H1 xlsx)** or remove/replace xlsx |
| Uploads / path traversal | Met (DB-backed; extension-only typing noted) |
| Sensitive data in logs | Met (`logRequest` — no file bodies/passwords) |
| Formula injection on CSV surfaces | Met on export; import name met; other fields L2 |

---

## Must-fix / must-accept before merge & publish

**Hard blockers (CRITICAL app issues):** none.

**Required notes before treating Ads Drop as shippable:**

1. **Olivia accepts H1 (`xlsx` HIGH, no npm fix)** for demo/GitHub source, **or** engineer drops XLSX / swaps parser before any untrusted-user or internet-facing deploy.
2. Explicitly **accept or fix M1/M2** (`note_on_match` / `lead_id` leakage) — PRD allows note-on-match globally; Desk authz model does not. Recommend fix before multi-agent production use.
3. Do **not** push until Product/Master confirms publish window (this review **did not push**).
4. Confirm `git status` never force-adds `.env.local` or `data/*.db*`.

**Before internet-facing production:** H1 resolution, M1–M3, prior report rate-limit / DB `chmod 600` / stronger passwords / `COOKIE_SECURE=true` + TLS.

---

## Sign-off recommendation

| Question | Answer |
|----------|--------|
| Merge Ads Drop into product readiness (local/demo)? | **APPROVE WITH NOTES** (`PASS_WITH_NOTES`) |
| GitHub publish of v0.2 source? | **APPROVE WITH NOTES** if H1 xlsx accepted (same bar as prior Next acceptance) |
| Production / public internet deploy? | **Not approved** until H1 addressed and M1 scoped |
| Push performed by this review? | **No** |

---

*End of SECURITY-REPORT-ADS-DROP.md — 2026-09-21 17:25 PKT*
