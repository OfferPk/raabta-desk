# QA Report — Raabta Desk MVP

**Project:** `/workspace/factory/projects/raabta-desk`  
**Project ID:** `proj_raabta_desk_001`  
**Status at test:** TESTING  
**QA date:** 2026-09-21 (Asia/Karachi, PKT)  
**QA agent:** QA Bug Hunter (executor)  
**Overall recommendation:** **NEEDS FIXES**

---

## Summary

Raabta Desk MVP is functionally complete against the PRD core loop: auth, owner/agent roles, leads CRUD, Kanban stage moves, follow-up queue, activity notes, `wa.me` links, dashboard, and owner-only CSV export. Automated tests **9/9 pass**. API smoke (curl + session cookies) confirms seed logins, role isolation on leads/notes/export, and WhatsApp URL generation.

**No Critical authz IDOR** (agent cannot read/patch/delete/note another user’s leads; export returns 403 for agents). Several **High/Medium** validation and hardening gaps should be fixed before calling the MVP “ready”: empty name/phone on PATCH, weak phone validation, CSV formula injection, multi-owner creation, and production `Secure` cookies breaking browser login on HTTP `next start`.

| Severity | Count |
|----------|------:|
| Critical | 0 |
| High     | 2 |
| Medium   | 5 |
| Low      | 5 |

---

## Environment / how tested

| Item | Detail |
|------|--------|
| Path | `/workspace/factory/projects/raabta-desk` |
| Stack | Next.js 14.2.35, TypeScript, Tailwind, better-sqlite3, bcryptjs, vitest |
| Node | production `next-server` already listening on `:3000` (cwd project root) |
| DB | SQLite `data/raabta.db` (pre-seeded; prior QA mutations present; seed script re-run not required for smoke) |
| Demo creds | Owner `owner@raabta.local` / `owner123`; Agent `agent@raabta.local` / `agent123` |
| Method | `npm test`; API smoke via `curl` + cookie jars; static review of `src/lib/*`, `src/app/api/**`, UI components |
| Not done | Full interactive browser UI pass (API + SSR HTML checks preferred per brief); no GitHub push |

---

## Test results

Command: `cd /workspace/factory/projects/raabta-desk && npm test`

```
 RUN  v2.1.9 /workspace/factory/projects/raabta-desk

 ✓ tests/phone.test.ts (6 tests)
 ✓ tests/smoke.test.ts (3 tests)

 Test Files  2 passed (2)
      Tests  9 passed (9)
```

Coverage: phone normalizer / `wa.me` / PK hint; smoke DB hash + follow-up filter + pipeline sum.  
**Gap:** no HTTP/API authz, export, or validation integration tests.

---

## Smoke results checklist

| Check | Result | Evidence |
|-------|--------|----------|
| App responds on :3000 | PASS | `GET /` → 307; desk routes 200 when authed |
| Seed / demo login owner | PASS | `POST /api/auth/login` → 200 + `raabta_session` HttpOnly cookie |
| Seed / demo login agent | PASS | Same for agent |
| Leads list owner sees all | PASS | Owner `GET /api/leads` count ≥ seeded + mutations |
| Leads list agent sees own only | PASS | Agent count matched owner_id filter |
| Lead create | PASS | Agent `POST /api/leads` → 201 |
| Stage change | PASS | `PATCH` → `follow_up` / invalid stage → 400 |
| Follow-up queue / Done / Tomorrow | PASS | Dashboard `follow_ups`; `next_follow_up` null / +1 day |
| Notes append | PASS | `POST .../notes` → 201; empty body → 400 |
| `wa.me` link | PASS | Lead HTML `href="https://wa.me/923007778899"`; phone util strips non-digits |
| CSV export owner | PASS | `GET /api/export/leads.csv` → **200** `text/csv` |
| CSV export agent | PASS | → **403** `{"error":"Forbidden — owners only"}` |
| CSV unauthenticated | PASS | → **401** |
| Agent IDOR GET/PATCH/DELETE/notes on foreign lead | PASS | All **403** |
| Agent forge `owner_id` on create | PASS | Ignored; lead owned by agent |
| Public register after bootstrap | PASS | **403** workspace already has owner |
| Agent create user | PASS | **403** |
| Board / follow-ups SSR | PASS | 200 for authed users; agent board omits other owners’ lead names |

---

## Findings

| ID | Severity | Title | Repro | Likely cause | Fix request |
|----|----------|-------|-------|--------------|-------------|
| F1 | **High** | `PATCH /api/leads/:id` accepts empty `name` / `phone` | Auth as agent; `PATCH` with `{"name":""}` or `{"phone":"  "}` → 200 and stores `""` | `[id]/route.ts` copies trimmed strings without re-checking required fields (`route.ts` ~49–50) | After building patch, reject if `name` or `phone` is present and `trim()` is empty (400 `"Name and phone are required"`). Mirror create validation. |
| F2 | **High** | Production `Secure` session cookie breaks browser login on HTTP `next start` | `POST /api/auth/login` Set-Cookie includes `Secure` when `NODE_ENV=production`; browsers on `http://localhost:3000` will not store/send it | `src/lib/auth.ts` `secure: process.env.NODE_ENV === "production"` (~69) | Gate secure with explicit env (e.g. `COOKIE_SECURE=true`) or `x-forwarded-proto === https`; document that `next start` over plain HTTP needs `COOKIE_SECURE=false` for local demos. Keep Secure default for real HTTPS deploys. |
| F3 | **Medium** | No phone quality validation on create/update | `POST /api/leads` with `"phone":"123"` → 201; `wa.me` then fails (`normalizePhoneDigits` needs ≥8 digits) | API only checks non-empty string (`leads/route.ts` ~40–45) | Require `normalizePhoneDigits(phone)` non-null on create/PATCH; return 400 with hint to use country code (e.g. `92300…`). Optionally persist normalized digits. |
| F4 | **Medium** | CSV formula injection in export | Create lead name `=CMD\|'/c calc'!A1`; owner export line contains raw `=CMD...` | `csvEscape` only quotes commas/quotes/newlines (`export/leads.csv/route.ts` ~5–8) | Prefix cells that start with `=`, `+`, `-`, `@` with `'` (or tab), and/or force Excel-safe quoting for all text fields. |
| F5 | **Medium** | Owner can create additional `owner` users | `POST /api/users` as owner with `"role":"owner"` → 201; UI Team form offers Owner option | `users/route.ts` ~33 `body.role === "owner" ? "owner" : "agent"`; `users/page.tsx` select | Restrict API to `role: "agent"` only (ignore/forbid owner); remove Owner option from Team UI unless product explicitly wants multi-owner. |
| F6 | **Medium** | Invalid `owner_id` on create returns 500 | Owner `POST /api/leads` with nonexistent UUID → 500 `Failed to create lead` | FK failure from SQLite not mapped to 400 | Before insert, `SELECT id FROM users WHERE id=?`; if missing return 400 `"Invalid owner_id"`. |
| F7 | **Medium** | Missing automated tests for authz / export / validation | Only phone + DB smoke tests | `tests/` has 2 files | Add vitest (or API) tests: agent 403 on foreign lead & export; owner 200 export; empty PATCH name 400; short phone 400. |
| F8 | **Low** | Negative deal values accepted | `POST` `"value":-5000` → negative `value_cents` | `Math.round(v * 100)` without floor | Clamp `value_cents = Math.max(0, …)` on create/update. |
| F9 | **Low** | Agents can enumerate all user emails | `GET /api/users` as agent returns full email list | Intentional for assignment display but over-shares | For non-owners return `{id,name,role}` only (omit email), or limit to id+name. |
| F10 | **Low** | `SESSION_SECRET` unused | `.env.example` documents secret; auth never reads it | Sessions are random UUIDs in DB only (`auth.ts` createSession) | Either HMAC-sign cookie payload with `SESSION_SECRET`, or update README/STATUS to say secret is reserved/unused so operators are not misled. |
| F11 | **Low** | Unbounded note body size | `POST` note with 50k chars → 201 | No max length in notes route | Reject body longer than e.g. 5_000 chars (400). |
| F12 | **Low** | Local PK `03…` phones stored without normalization | Create `"phone":"03001234567"` stored as-is; UI hint only | `phoneHint` not enforced | On create/update, if digits match `03`+11, auto-rewrite to `92`+rest or require confirmation; still validate via `normalizePhoneDigits`. |

### Non-bugs / mitigated

- **Stored XSS in name/notes:** payloads stored, but React text nodes escape (`&lt;img …&gt;` in SSR). No `dangerouslySetInnerHTML` in `src/`. Residual risk is CSV/Excel (F4), not browser HTML.
- **CSRF:** `SameSite=lax` + HttpOnly cookie acceptable for same-site MVP.
- **SQL injection:** parameterized `better-sqlite3` statements; classic SQLi string not executed as SQL.
- **Agent stage/delete on own leads:** allowed per PRD (“agents can CRUD assigned + create”).

---

## Gaps vs PRD

| PRD item | Status |
|----------|--------|
| Auth register/login/logout, hashed passwords, session cookie | Met (register locked after first owner) |
| First user owner; owner creates agents | Met; **extra:** can also create owners (F5) |
| Leads CRUD + stages + value PKR + follow-up | Met |
| Pipeline board (buttons OK vs drag) | Met |
| Follow-up queue due today + overdue; done / snooze | Met |
| Append-only activity notes | Met |
| WhatsApp `wa.me` | Met (weak phone gate F3) |
| Dashboard counts / overdue / open pipeline | Met |
| CSV export owner-only | Met (formula hardening F4) |
| Seed + README | Met |
| Lead “notes field (short)” on record | Soft gap — only activity notes table; acceptable if product accepts |
| Unit tests phone + stage; integration auth+lead+follow-up | Partial — phone yes; authz/export API tests missing (F7) |
| Urdu / soft-delete / tags | Out of MVP — OK |

---

## Recommendation

**NEEDS FIXES** — not BLOCKED.

Ship blockers to clear before READY:

1. **F1** — reject empty name/phone on PATCH  
2. **F3** — enforce phone normalizer on write  
3. **F4** — CSV formula-safe escape  
4. **F5** — stop creating extra owners (API + UI)  
5. **F2** — document/fix Secure cookie for local `next start`  

F6–F7 strongly recommended in the same pass. Lows can follow as polish.

**Do not push to GitHub** (per STATUS / brief).

---

## Appendix — sample smoke commands

```bash
# Login owner
curl -s -c /tmp/o.jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@raabta.local","password":"owner123"}'

# Export
curl -s -b /tmp/o.jar -o /tmp/leads.csv -w "%{http_code}\n" \
  http://localhost:3000/api/export/leads.csv   # 200

# Agent export
curl -s -c /tmp/a.jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"agent@raabta.local","password":"agent123"}'
curl -s -b /tmp/a.jar -w "%{http_code}\n" \
  http://localhost:3000/api/export/leads.csv   # 403
```
