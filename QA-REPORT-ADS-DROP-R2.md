# QA Report R2 — Raabta Ads Drop fixes AD-01–AD-04 (Desk v0.2)

**Date:** 2026-09-21 17:23 PKT (Asia/Karachi)  
**QA:** Re-verify for QA Bug Hunter  
**Project:** `/workspace/factory/projects/raabta-desk`  
**Branch:** `feature/ads-drop` (working tree with Ads Drop + AD fixes; **not pushed**)  
**Version:** `0.2.0`  
**Prior:** `QA-REPORT-ADS-DROP.md` (NEEDS FIXES — AD-01 Medium + AD-02/03/04 Low)  
**Fix notes:** `FIX-NOTES.md` § Ads Drop QA

---

## Overall recommendation

### **READY**

AD-01, AD-02, AD-03, and AD-04 all **PASS** with live API evidence and vitest coverage.  
`npm test` **31/31**; `npm run build` success; production `next start` on `:3000` with `COOKIE_SECURE=false`.  
Ads Drop happy path + Desk regression (login, IDOR, CSV export roles, F1/F3/F11) remain green. No new Critical/High/Medium defects found in this re-verify.

| Severity (new this R2) | Count |
|------------------------|------:|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 0 |
| Info     | 1 (unchanged tree status) |

---

## Environment

| Item | Detail |
|------|--------|
| Runtime | `COOKIE_SECURE=false npm run build` then `COOKIE_SECURE=false npm run start -- -p 3000` |
| DB | `npm run db:reset` then live API + direct `better-sqlite3` inserts for legacy phone |
| Creds | `owner@raabta.local` / `owner123` · `agent@raabta.local` / `agent123` |
| Fixtures | `fixtures/meta-leads-sample.csv`, `.xlsx`, plus `/tmp` AD CSVs |
| Methods | vitest; curl Route Handlers; Node DB inspection |

---

## AD-01..04 results

| ID | Sev | Title | Result | Evidence |
|----|-----|-------|:------:|----------|
| **AD-01** | Medium | Phone dedupe normalizes both sides | **PASS** | Code: `findLeadByPhone` applies `preparePhoneForStorage` to query **and** each stored `r.phone`. Seed `Sana Malik` phone = `923007778899`. Live: inserted legacy `Legacy Format Live` with `+92 300 7778899`; import `923007778899` → commit `created=0`, `skipped_dupes=1`, row outcome `duplicate_phone`; no `Should Match Legacy` lead created. Vitest: `AD-01: formatted DB phone matches normalized import digits`. |
| **AD-02** | Low | `nudge_hours` allowlist | **PASS** | `PATCH …/mapping` with `nudge_hours: 99` → **400** `{"error":"nudge_hours must be null or one of 0, 2, 4, 24"}`. Value `2` → **200**, stored. Vitest AD-02. |
| **AD-03** | Low | `first_name`+`last_name` → `name` | **PASS** | Upload headers `first_name,last_name,phone_number` → default mapping both → `name` (not last→note). Commit produced lead name **`Hassan Raza`**. Vitest AD-03. |
| **AD-04** | Low | Neutralize leading `=+-@` on import write | **PASS** | Import name `=CMD\|'/c calc'!A1` stored as `'=CMD\|'/c calc'!A1` (leading `'`). Vitest AD-04 + `sanitizeSpreadsheetText`. |

**Pass/fail count: 4 PASS / 0 FAIL**

---

## Test / build results

| Command | Result |
|---------|--------|
| `npm test` | **31 passed** (phone 9, smoke 3, api 6, imports 13) |
| `npm run build` | **success** (Next.js 15.5.25) |
| Prod server | `COOKIE_SECURE=false npm run start -- -p 3000` Ready |

---

## Smoke checklist

### Ads Drop happy path

| Check | Result | Notes |
|-------|:------:|-------|
| CSV upload sample | **PASS** | 5 rows; smart Meta defaults (`id`→`meta_lead_id`, `phone_number`→`phone`, `full_name`→`name`, `campaign_name`→`meta_campaign`) |
| XLSX upload | **PASS** | 5 rows, status `uploaded` |
| Map + preview counts | **PASS** | `would_create:3`, `would_invalid:2` |
| Commit | **PASS** | `created:3`, `skipped_invalid:2` |
| Meta-id re-upload | **PASS** | `created:0`, `skipped_dupes:3` |
| Second commit | **PASS** | **409** `Job already committed` |
| Unauth import | **PASS** | **401** |
| Agent foreign job | **PASS** | **403** |
| Presets list | **PASS** | **200** `{presets:[]}` |

### Desk regression

| Check | Result | Notes |
|-------|:------:|-------|
| Owner/agent login | **PASS** | Cookies with `COOKIE_SECURE=false` |
| `/board` `/imports` `/dashboard` | **PASS** | **200** |
| Export owner / agent / unauth | **PASS** | **200** / **403** / **401** |
| Agent IDOR foreign lead | **PASS** | **403** |
| Empty name PATCH (F1) | **PASS** | **400** |
| Short phone create (F3) | **PASS** | **400** country-code hint |
| Note >5000 (F11) | **PASS** | **400** |
| wa.me on lead detail | **PASS** | `https://wa.me/923334445566` |

---

## New regressions

**None.**

(Transient curl scripting error earlier produced a mangled short-phone create → 500; clean retest → **400** as expected. Not a product regression.)

---

## Residual risks / info

| Item | Notes |
|------|-------|
| **Uncommitted tree** | Ads Drop + AD fixes still modified/untracked on `feature/ads-drop` — engineer should commit before publish (QA did not push). |
| **`findLeadByPhone` scan** | Loads all leads and normalizes in JS — correct for MVP; may need `phone_norm` index later. |
| **Lib `createLead` raw phone** | Domain helper still stores trimmed raw phone; API path + seed use/store E.164. Dedupe survives via both-side normalize. |
| **GET preview API** | `GET /api/imports/:id/preview` returned **405** in this build; preview payload is returned on mapping PATCH (happy path OK). |

---

## Recommendation

**READY** to accept Ads Drop AD fixes. No further AD-01–AD-04 work required for this gate. Commit working tree on `feature/ads-drop` before ship; do not push from QA.
