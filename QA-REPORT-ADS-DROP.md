# QA Report — Raabta Ads Drop (Desk v0.2)

**Date:** 2026-09-21 17:22 PKT (Asia/Karachi)  
**QA:** Independent pass for QA Bug Hunter  
**Project:** `/workspace/factory/projects/raabta-desk`  
**Branch:** `feature/ads-drop` (HEAD `bfa13d4` + uncommitted Ads Drop working tree; **not pushed**)  
**Version:** `0.2.0`  
**Docs:** `/workspace/factory/research/PRD-raabta-ads-drop.md`, `/workspace/factory/research/BUILD-BRIEF-raabta-ads-drop.md`

---

## Summary + overall recommendation

### **NEEDS FIXES**

Ads Drop happy path works end-to-end: CSV/XLSX upload → column map → phone gate → dedupe → bulk create → import report → presets → follow-up nudge → `wa.me`. Meta-id re-upload creates 0 leads; invalid phones never create leads; agent authz holds; Desk regression (auth, leads CRUD, stages, follow-ups, notes, export 200/403/401, agent IDOR 403, F1–F12) remains intact.

**Ship gate:** one **Medium** defect — phone dedupe uses exact `leads.phone` match, so unnormalized existing phones (seed still has `Sana Malik` = `+92 300 7778899`) are not detected; import of `923007778899` creates a duplicate lead. Fix that (plus Low nudge / name-map issues) before READY.

No Critical/High. No Meta Marketing API / WABA code paths.

| Severity | Count |
|----------|------:|
| Critical | 0 |
| High     | 0 |
| Medium   | 1 |
| Low      | 3 |
| Info     | 2 |

---

## Environment / how tested

| Item | Detail |
|------|--------|
| Runtime | `COOKIE_SECURE=false npm run build` then `COOKIE_SECURE=false npm run start -- -p 3000` |
| DB | `npm run db:reset` (seed) then live API calls |
| Creds | `owner@raabta.local` / `owner123` · `agent@raabta.local` / `agent123` |
| Fixtures | `fixtures/meta-leads-sample.csv`, `fixtures/meta-leads-sample.xlsx`, plus `/tmp` adversarial CSVs |
| Methods | `npm test` (vitest); curl E2E on Route Handlers; `better-sqlite3` DB inspection; HTML smoke for XSS escape / Nav / wa.me |
| Docs | BUILD-BRIEF, PRD §5 + §12, STATUS, FIX-NOTES, README, `src/lib/imports.ts`, `src/lib/import-map.ts`, `src/lib/import-parse.ts`, `src/app/api/imports/**`, UI pages |

---

## Test results (automation)

| Command | Result |
|---------|--------|
| `npm test` | **27 passed** (phone 9, smoke 3, api 6, imports 9) |
| `npm run build` | **success** (Next.js 15.5.25) |
| Prod server | Up on `:3000` after clearing stale process |

---

## Ads Drop checklist (evidence)

| # | Check | Result | Evidence |
|---|-------|:------:|----------|
| 1 | CSV upload | **PASS** | `POST /api/imports` 201; 5 rows; smart defaults `id`→`meta_lead_id`, `phone_number`→`phone`, `full_name`→`name`, `campaign_name`→`meta_campaign` |
| 1b | XLSX upload | **PASS** | Sample `.xlsx` parses via first sheet; same row path |
| 2 | Column map | **PASS** | `PATCH /api/imports/:id/mapping` → status `mapped`; mapping with zero phone columns → **400** |
| 3 | Phone gate | **PASS** | Blank + short digits → outcome `invalid`; PK local `03…` rewritten to `92…` via `preparePhoneForStorage` |
| 4 | Dedupe meta_lead_id | **PASS** | Re-upload same file → `created=0`, `skipped_dupes=3` (`duplicate_meta_id`); second commit → **409** |
| 4b | Dedupe phone (normalized) | **PASS** | Re-import of already-imported normalized phone → `duplicate_phone` |
| 4c | Dedupe phone (legacy format) | **FAIL** | **AD-01** — seed `Sana Malik` phone `+92 300 7778899`; import `923007778899` created `Should Match Sana` (both rows remain in DB) |
| 5 | Bulk create | **PASS** | First commit `{created:3, skipped_invalid:2}`; `source=meta_ads`, `stage=new`, `value_cents=0`, import note present |
| 6 | Import report | **PASS** | Report page + `GET /api/imports/:id/report.csv` with row outcomes; uses `csvEscape` |
| 7 | Presets | **PASS** | Saved named preset; `GET /api/imports/presets` lists it; header fingerprint auto-applies on matching upload |
| 8 | Follow-up nudge | **PASS** | `nudge_hours=0` sets `next_follow_up`; imported leads appear in dashboard follow-ups / due_today |
| 9 | Authz | **PASS** | Unauth POST → **401**; agent GET owner job → **403**; agent `default_owner_id` forced to self; agent list = own jobs only |
| 10 | Limits | **PASS** | Empty / header-only / >5MB / >2000 rows / wrong extension → **400** |
| 11 | note_on_match | **PASS** | Preview `would_note_on_match≥1`; commit increments count; note appended on matched lead |
| 12 | XSS | **PASS** | `<script>` escaped in lead detail HTML (`&lt;script&gt;` / `\u003c…\u003e`) |
| 13 | Formula injection | **PASS*** | Export prefixes `'` on `=…`/`+…` names (*DB still stores raw — AD-04) |
| 14 | Race commit | **PASS** | Parallel commits → one success + one already-committed; lead count correct |
| 15 | No Meta API | **PASS** | Deps `papaparse@5.5.2`, `xlsx@0.18.5` only |

---

## Desk regression checklist

| Area | Result | Notes |
|------|:------:|-------|
| Auth owner/agent | **PASS** | Login cookies with `COOKIE_SECURE=false` |
| Leads CRUD / stages / board | **PASS** | `/board` 200; imported `stage=new` |
| Follow-ups | **PASS** | Nudged imports in due_today |
| Notes max 5000 | **PASS** | 5001 → 400 (F11) |
| wa.me | **PASS** | Lead detail exposes `https://wa.me/<digits>` |
| Export owner 200 / agent 403 / unauth 401 | **PASS** | |
| Agent IDOR foreign lead 403 | **PASS** | |
| Empty name PATCH 400 | **PASS** | F1 |
| Short phone create 400 | **PASS** | F3 |
| F1–F12 via suite | **PASS** | `npm test` green |

---

## Findings table

| ID | Sev | Title | Repro | Cause | Precise fix request |
|----|-----|-------|-------|-------|---------------------|
| **AD-01** | **Medium** | Phone dedupe misses unnormalized existing phones | After seed, import CSV row with phone `923007778899` (digits of seed `Sana Malik` `+92 300 7778899`). Map + commit. **Expected:** `duplicate_phone`. **Actual:** new lead `Should Match Sana` created; DB keeps both rows. | `findLeadByPhone` does `WHERE phone = ?` with normalized import digits only. | Normalize both sides in phone lookup (reuse `preparePhoneForStorage` / digit strip on DB values, or add/maintain `phone_norm`). Normalize seed phones in `scripts/seed.ts`. Add vitest: insert formatted phone → import E.164 → must skip as dupe. |
| **AD-02** | **Low** | `nudge_hours` accepts values outside `{0,2,4,24,null}` | `PATCH …/mapping` with `"nudge_hours": 99` → stored as 99. | Validation only coerces `NaN`; non-allowlist numbers pass. | Return **400** unless `nudge_hours` is `null` or in `{0,2,4,24}`. Add API test. |
| **AD-03** | **Low** | `first_name`+`last_name` defaults do not join into `name` | Headers `first_name,last_name,phone_number` → default map sets `last_name`→`note`. | `defaultMapping` assigns last→note; join only happens for multiple `name` targets. | Map both `first_name` and `last_name` → `name` when no `full_name`/`name`, so join yields `"First Last"`. Unit test. |
| **AD-04** | **Low** | Formula-like names stored raw | Import name `=CMD\|…` persists on `leads.name` (export/UI mitigated). | Commit writes mapped name without spreadsheet neutralization. | On import write, neutralize leading `= + - @` (same spirit as `csvEscape`), or accept export-only mitigation and document. Prefer write-time neutralize. |
| **AD-05** | **Info** | Fixture comment vs seed phone | Fixture row claiming seed phone match uses a number not present in seed — first commit creates it. | Fixture/docs drift (not a product dedupe bug). | Align fixture phone to a real seed number **or** fix the comment; keep vitest self-seed as truth. |
| **AD-06** | **Info** | Ads Drop tree uncommitted | `git status` shows Ads Drop files modified/untracked at HEAD `bfa13d4`. | WIP. | Engineer commit on `feature/ads-drop` before publish (QA did not push). |

---

## Gaps vs PRD / BUILD-BRIEF

| Requirement | Gap? |
|-------------|------|
| 8 MVP features | Functionally present; **AD-01** weakens “normalized phone matches any existing lead” |
| ≤5MB / ≤2000 rows / CSV+XLSX | Met |
| Smart Meta defaults | Met |
| Commit txn + 409 second commit | Met |
| Agent owner forced to self | Met |
| Presets by header fingerprint | Met |
| Nudge 0/2/4/24 | UI intent met; API validation incomplete (**AD-02**) |
| first_name+last_name → name | Partial (**AD-03**) |
| Report CSV formula-safe | Met (`csvEscape`) |
| No Meta API | Met |
| v0.2.0 + STATUS/README | Met in working tree |
| Manual E2E ≤3 min | Met for API-driven path; UI `/imports` map/preview/report return 200 |

---

## Blockers

- **None** (no Critical/High).  
- **Acceptance gate:** fix **AD-01** before calling Ads Drop done; include AD-02/AD-03 in same PR if possible.

---

## Recommendation

**NEEDS FIXES.** Re-QA AD-01 (and AD-02/AD-03) after patch → then **READY**. Do not push until engineer commits the Ads Drop working tree on `feature/ads-drop`.
