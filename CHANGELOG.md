# Changelog — Raabta Desk

All notable changes in this project.

Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
### Changed
### Fixed
### Security

## [0.3.0] — 2026-09-21

### Added

- **Soft-archive leads** — `archived_at` on leads; Archive/Unarchive on lead detail; default board/queue/dashboard hide archived; Board **Show archived** filter; CSV export includes `archived_at` (full dump).
- **Empty-state onboarding** — bilingual (EN + Roman Urdu) 3-step checklist on dashboard/board/Ads Drop when empty; dismissible via settings; **Seed sample lead** CTA.
- **Ads Drop import cadence reminder** — owner setting `import_remind_days` (default 3); dashboard banner when no successful import in N days.
- **Quick note templates** — 8 EN/Roman Urdu templates on lead detail (insert into note field).
- **Pipeline health strip** — overdue count/value, stale open leads, imports this week (click-through).
- Settings API `GET/PATCH /api/settings`; sample lead `POST /api/leads/sample`.
- **Leads list** (`/leads`) with filters (stage/source/campaign/owner/archived) + nav link (coordinated).
- **WhatsApp message chips** (coordinated): prefilled `wa.me?text=` chips on lead detail + follow-ups.
- **Auth hardening** (coordinated): soft in-memory login/register rate limit (≤10 fails / 15 min → 429); register/agent password min **10** chars.

### Changed

- Dashboard stats exclude archived leads; expose archive/stale/import cadence fields.
- Version **0.3.0**.

## [0.2.0] — 2026-09-21

### Added

- **Ads Drop** — Meta Lead Ads / Instant Forms CSV or XLSX upload → map → preview → commit into the shared desk (`source=meta_ads`).
- Import APIs under `/api/imports/**` (upload, job, mapping, preview, commit, report CSV) and mapping presets.
- Schema: `meta_lead_id` / `meta_campaign` on leads; tables `import_jobs`, `import_job_rows`, `import_mapping_presets`.
- Nav **Ads Drop** UI (`/imports`) plus map / preview / report pages.
- Dedupe by Meta lead id then normalized phone; optional follow-up nudge (`0` / `2` / `4` / `24` hours); optional note-on-phone-match.
- Fixtures: `fixtures/meta-leads-sample.csv`, `fixtures/meta-leads-sample.xlsx`.
- Dependencies: `papaparse`, `xlsx` (no Meta Marketing API / WABA SDKs).
- Import tests; suite expanded (STATUS: 27 passed at ship).

### Fixed

- AD-01: phone dedupe normalizes both query and stored numbers.
- AD-02: invalid `nudge_hours` rejected.
- AD-03: `first_name` + `last_name` combine into `name` when no full name column.
- AD-04: neutralize leading `= + - @` on imported names (spreadsheet formula injection).

### Security

- M1: agent cannot `note_on_match` on leads they cannot access (counts as `duplicate_phone`).
- M2: foreign `lead_id` redacted on agent job rows / report CSV.
- M3: commit claims `committing` and runs evaluate+writes in one SQLite transaction (race hardened).
- H1 (`xlsx` advisory) accepted / unchanged for this release.

## [0.1.0] — 2026-09-21

### Added

- Initial MVP: Next.js App Router + TypeScript + Tailwind + SQLite (`better-sqlite3`).
- Auth: register (first user = owner), login, logout; bcrypt passwords; httpOnly session cookies.
- Owner Team page / API to create **agent** users only.
- Leads CRUD with stages `new | qualified | follow_up | won | lost`; Kanban board with stage buttons.
- Follow-up queue (due today + overdue); append-only notes (max 5000 chars).
- WhatsApp button → `https://wa.me/<digits>`; PK phone `03…` → `92…` on write.
- Dashboard counts + open pipeline value (PKR).
- Owner CSV export at `/api/export/leads.csv` (formula-safe escaping).
- Seed script + demo logins; README / product docs.

### Security

- Upgraded to Next.js **15.5.25** (and matching eslint-config-next) before publish; production audit 0 critical / 0 high at v0.1.0 publish (`PUBLISH.md`).
- `COOKIE_SECURE` env for local HTTP vs HTTPS cookie Secure flag.
- `SESSION_SECRET` documented as reserved/unused (UUID sessions in DB).

### Publish

- GitHub: https://github.com/OfferPk/raabta-desk — release [v0.1.0](https://github.com/OfferPk/raabta-desk/releases/tag/v0.1.0).

[Unreleased]: https://github.com/OfferPk/raabta-desk/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/OfferPk/raabta-desk/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/OfferPk/raabta-desk/releases/tag/v0.2.0
[0.1.0]: https://github.com/OfferPk/raabta-desk/releases/tag/v0.1.0
