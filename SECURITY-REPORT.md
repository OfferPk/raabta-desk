# Security Review — Raabta Desk MVP

| Field | Value |
|-------|-------|
| **Project** | `/workspace/factory/projects/raabta-desk` |
| **Date** | 2026-09-21 (Asia/Karachi, PKT) |
| **Reviewer** | Security Reviewer (executor) |
| **Scope** | Pre–GitHub-publish review of MVP source (auth, API, DB, export, config, deps). No application source changes. No GitHub push. |
| **Prior context** | `QA-REPORT-R3.md` (READY), `FIX-NOTES.md` (F1–F12 + R2-R1), `shared/security/RELEASE_GATE.md` |
| **Overall verdict** | **PASS_WITH_NOTES** |

---

## Executive summary

Raabta Desk’s application-layer security for the MVP is in good shape for a **local/demo GitHub publish**: session cookies are `httpOnly` + `sameSite=lax` with a sensible `Secure` gate; passwords use bcrypt (cost 10); public registration closes after the first owner; lead/note/export/user routes enforce auth and ownership/role checks; SQL uses parameterized statements; CSV export neutralizes formula injection; `.gitignore` covers `.env.local` and `data/*.db`; request logs do not record passwords or session IDs; there are no upload handlers.

Residual risks that keep this from a clean **PASS**:

1. **`npm audit --omit=dev` reports 1 critical (next@14.2.35) and 1 high (nested postcss)** — RELEASE_GATE requires a clean critical/high audit **or Olivia’s documented risk acceptance** before ship.
2. Hardening gaps: no login rate limit, SQLite file mode `644`, password minimum of 6 characters, CSRF defense relies on `SameSite=lax` (no anti-CSRF token), demo seed credentials documented in README.

**Sign-off for GitHub publish:** **Yes, with notes** — publish source only if (a) `.env.local` / `data/*.db*` remain untracked, and (b) Olivia accepts Next.js/postcss audit findings **or** a Next upgrade is planned before any internet-facing deploy. Do **not** treat this as production-hardening sign-off.

---

## Checklist (required areas)

| # | Area | Result | Evidence summary |
|---|------|--------|------------------|
| 1 | Auth / sessions / cookies | **PASS** | bcrypt hash/verify (`src/lib/auth.ts` L9–15); UUID sessions in SQLite (L17–25); cookie `httpOnly: true`, `sameSite: "lax"`, `secure` via `shouldUseSecureCookie` (L73–97); no JWT. Login/register/logout/me routes present. |
| 2 | IDOR / authorization | **PASS** | `canAccessLead` (`src/lib/leads.ts` L254–260); enforced on GET/PATCH/DELETE lead + notes; agents scoped on list/dashboard; export + `POST /api/users` use `requireOwner`. QA-R3: agent foreign lead → 403. |
| 3 | Input validation | **PASS_WITH_NOTES** | Name/phone required; phone via `preparePhoneForStorage`; stage enum; note max 5000; value clamped ≥0; password min 6. Gaps: weak min password; little server-side email format / field length caps. |
| 4 | SQL injection | **PASS** | All reviewed queries use `db.prepare(...).get/run/all(?)` — no string-concatenated user SQL (`src/lib/db.ts`, `leads.ts`, auth/API routes). |
| 5 | CSV injection | **PASS** | `csvEscape` prefixes `=+-@` with `'` (`src/lib/csv.ts` L1–8); used in export route (`src/app/api/export/leads.csv/route.ts` L41). |
| 6 | Secrets in repo | **PASS** | `.gitignore` includes `.env*.local`, `.env.local`, `.env`, `/data/*.db`, `/data/*.db-*`. `.env.local` **present** on disk (dev values; **not copied here**). `.env.example` placeholders only. No `AKIA`/`sk-`/Bearer tokens in `src`. |
| 7 | Dependency risk | **FAIL → noted** | `npm audit --omit=dev`: **1 critical** (`next`), **1 high** (`postcss` via next). See finding H1. |
| 8 | Insecure defaults | **PASS_WITH_NOTES** | Register locked after first user (`register/route.ts` L46–56). Demo passwords in seed/README (expected). SQLite `644`. `COOKIE_SECURE=false` for local HTTP (documented). `SESSION_SECRET` unused (documented). |
| 9 | Logging of secrets | **PASS** | `logRequest` logs requestId/route/userId/duration/status/error only (`src/lib/logger.ts`). Login success logs `userId`, not password or session id. |
| A | Uploads | **PASS (N/A)** | No multipart/file upload API; `FormData` only builds JSON client-side. |
| B | Error leakage | **PASS** | API catch blocks return generic JSON errors to clients; `String(e)` only in server logs (login/register/leads create). |
| C | CORS / CSRF | **PASS_WITH_NOTES** | No permissive CORS headers. Mutating APIs are cookie + JSON `fetch` same-origin; `SameSite=lax` mitigates classic cross-site POST CSRF. No explicit CSRF token. |
| D | Admin surfaces | **PASS** | Team UI + `POST /api/users` owner-only; role forced to `agent`; export owner-only. Nav hides Team for agents (UI only — API still enforced). |

---

## Findings

| ID | Severity | Title | Evidence | Risk | Remediation |
|----|----------|-------|----------|------|-------------|
| **H1** | **HIGH** | Next.js / postcss known vulnerabilities (`npm audit`) | `package.json` pins `next@14.2.35`; `npm audit --omit=dev` → critical on `next`, high on nested `postcss`. Advisories include DoS (RSC/Image Optimizer), cache poisoning, and several SSRF/RCE classes (some platform-specific). App does not use `next/image` in `src/`. | Internet-facing or untrusted-network deploys inherit framework CVEs; supply-chain gate fails RELEASE_GATE unless accepted. | Prefer upgrade to a patched Next release when feasible (audit suggests major bump). Until then: **Olivia documents risk acceptance** for MVP GitHub publish / local demo only; do not expose to the public internet without a plan to upgrade. Re-run `npm audit` after any bump. |
| **M1** | **MEDIUM** | No rate limiting on login / register | `src/app/api/auth/login/route.ts`, `register/route.ts` — no throttle/lockout. | Online password guessing against demo or weak passwords. | Add IP/email rate limit (or reverse-proxy limit); consider lockout after N failures; force stronger passwords in prod. |
| **M2** | **MEDIUM** | SQLite DB world-readable (`644`) | `stat`: `data/raabta.db` mode `644`; created by better-sqlite3 defaults (`src/lib/db.ts`). | On a shared host, other local users can read leads/sessions/password hashes. | `chmod 600` after create (or umask); document deploy permissions; keep `data/` off shared volumes; never commit DB (already gitignored). |
| **M3** | **MEDIUM** | Weak password policy (min 6) | `register/route.ts` L28–32; `users/route.ts` L65–69. | Credential stuffing / guessing easier. | Raise minimum (e.g. 10+), optional complexity; reject known-demo passwords in non-dev. |
| **M4** | **MEDIUM** | CSRF relies solely on `SameSite=lax` | Cookie flags `src/lib/auth.ts` L91–96; mutating routes accept cookie session without CSRF token. No custom CORS. | Low for modern browsers + same-site JSON APIs; residual risk from older browsers or lax mis-use. | Keep `SameSite=lax` (or `strict` if UX allows); optional double-submit / Origin check on POST/PATCH/DELETE; never set broad `Access-Control-Allow-Origin` with credentials. |
| **L1** | **LOW** | `SESSION_SECRET` unused | `.env.example` L4–5; `auth.ts` stores raw UUID session ids in DB/cookie. Documented in README/STATUS. | Cookie theft = session theft (no HMAC binding); acceptable for MVP if TLS + httpOnly. | Future: signed/encrypted cookie or rotate session on privilege change; until used, omit unused secret from prod env to avoid false sense of security. |
| **L2** | **LOW** | Limited server-side email / length validation | Leads/users accept email as free string; name/source length uncapped beyond JSON body limits. | Soft DoS / junk data; minor XSS risk mitigated by React text escaping (`LeadDetail.tsx` L281). | Validate email format; cap string lengths (name/source/email). |
| **L3** | **LOW** | `Secure` cookie depends on env / `x-forwarded-proto` | `shouldUseSecureCookie` `src/lib/auth.ts` L73–84. | Mis-set `COOKIE_SECURE=false` on real HTTPS, or spoofed proto without trusted proxy stripping, weakens cookie transport. | Production: `COOKIE_SECURE=true` behind real TLS; trust proto only from known proxy; never expose app plain-HTTP on the internet. |
| **I1** | **INFO** | Demo credentials in seed/README | `scripts/seed.ts` L88–100, L222–224; `README.md` L21–26. | Expected for MVP demo; dangerous if seed DB is deployed publicly unchanged. | README already labels demo; before any shared deploy: re-seed with unique passwords or disable seed accounts. |
| **I2** | **INFO** | `.env.local` present on workspace disk | File exists; keys: `DATABASE_PATH`, `SESSION_SECRET` (placeholder-like), `COOKIE_SECURE`, `NODE_ENV`. Values **redacted** from this report. Covered by `.gitignore`. | Accidental `git add -f` could leak. | Confirm ignore on first `git init`/`git status`; never force-add. |
| **I3** | **INFO** | No Next.js middleware.ts | Desk layout redirects unauthenticated users (`src/app/(desk)/layout.tsx` L10–11); APIs call `requireUser`/`requireOwner`. | Defense-in-depth only — API checks are the control. | Optional middleware for early redirect; keep API authz as source of truth. |

### Positive controls (no finding)

- Registration closed after first owner (`register/route.ts` L46–56).
- Owner cannot create second owner via Team API (`users/route.ts` L49–56).
- Agent email omitted on `GET /api/users` for non-owners (`users/route.ts` L22–29).
- Parameterized SQL throughout; foreign keys ON (`db.ts` L30).
- CSV formula neutralization verified in QA-R3.
- No `dangerouslySetInnerHTML` in `src/`.
- No hard-coded cloud API keys in source.

---

## RELEASE_GATE mapping

| Gate item | Status |
|-----------|--------|
| Secrets only via env; `.env.example` placeholders | Met (ensure `.env.local` never committed) |
| Authz on privileged actions | Met |
| Validation + parameterized queries | Met (with hardening notes) |
| Dependency audit clean critical/high **or Olivia acceptance** | **Needs Olivia acceptance (H1)** or upgrade |
| Uploads / path traversal | N/A — no uploads |
| Sensitive data in logs | Met |
| Open CORS / CSRF on cookie mutators | No open CORS; CSRF mitigated by SameSite (M4) |

---

## Must-fix / must-accept before publish

**Hard blockers (CRITICAL app issues):** none found for this MVP.

**Required before GitHub publish (notes):**

1. Initialize git so `.gitignore` applies; verify `git status` does **not** list `.env.local` or `data/*.db*`.
2. **Olivia risk-accepts H1** (Next/postcss audit) for source publish / local demo, **or** schedule a Next upgrade before any public deploy.
3. Do not push until Product/Master confirms publish window (per task: do **not** push from this review).

**Before internet-facing production:** address H1 (upgrade), M1–M3, set `COOKIE_SECURE=true` + TLS, chmod DB `600`, change all demo passwords.

---

## Sign-off recommendation

| Question | Answer |
|----------|--------|
| GitHub publish of MVP source? | **APPROVE WITH NOTES** (`PASS_WITH_NOTES`) |
| Production / public internet deploy? | **Not approved** until H1 resolved or explicitly accepted with compensating controls (TLS, no demo creds, rate limits) |
| Push performed by this review? | **No** |

---

*End of SECURITY-REPORT.md — 2026-09-21 PKT*
