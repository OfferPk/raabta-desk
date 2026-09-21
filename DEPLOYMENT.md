# Deployment — Raabta Desk

## Target

Self-hosted Node process (VPS, bare metal, or any host that can run `next start`).  
**No specific cloud host is prescribed** by this repo — use whatever runs Node 20+ and can persist a SQLite file.

Published source: https://github.com/OfferPk/raabta-desk  
Release tags: [v0.1.0](https://github.com/OfferPk/raabta-desk/releases/tag/v0.1.0), [v0.2.0](https://github.com/OfferPk/raabta-desk/releases/tag/v0.2.0) (Ads Drop).

## Pre-flight

- [ ] No secrets in git (`.env.local`, `data/*.db*` gitignored)
- [ ] Env vars set on the host (see [CONFIGURATION.md](./CONFIGURATION.md))
- [ ] Persistent volume/path for `DATABASE_PATH` (SQLite must survive restarts)
- [ ] HTTPS terminated in front of the app **or** `COOKIE_SECURE` set correctly
- [ ] Demo seed passwords not used on a public instance
- [ ] `npm test` and `npm run build` pass on the build machine

## Build

```bash
git clone https://github.com/OfferPk/raabta-desk.git
cd raabta-desk
npm install
# optional first-time demo only — do NOT seed production with demo passwords
# npm run seed
npm run build
```

Package scripts (from `package.json`):

| Script | Use |
|--------|-----|
| `npm run build` | `next build` |
| `npm start` | `next start` (production server) |
| `npm run dev` | Development only |
| `npm run seed` / `npm run db:reset` | Local/demo DB wipe + seed |

## Run

```bash
# Example: HTTPS behind a reverse proxy that sets x-forwarded-proto
export DATABASE_PATH=./data/raabta.db
export COOKIE_SECURE=true   # or leave unset if proto header is reliable
export NODE_ENV=production
npm start
```

Default listen: Next.js production port **3000** (override with `PORT` if your host documents it — Next respects standard `PORT` when set by the platform).

### COOKIE_SECURE notes

| Situation | Setting |
|-----------|---------|
| Local `npm start` over **HTTP** | `COOKIE_SECURE=false` — otherwise browsers drop the session cookie when `NODE_ENV=production` |
| Public site on **HTTPS** | `COOKIE_SECURE=true`, or unset + ensure `x-forwarded-proto: https` |
| Mis-set Secure on HTTP | Symptoms: login “succeeds” in API but UI stays logged out |

Details: `shouldUseSecureCookie` in `src/lib/auth.ts`.

## First owner (production)

Do **not** rely on demo seed. With an empty DB:

1. Open `/register`
2. Create the first account → becomes **Owner**
3. Create agents under **Team**
4. Change any temporary passwords

## Data & backups

- Single file (plus WAL/SHM): path from `DATABASE_PATH` (default `./data/raabta.db`)
- On open/create the app attempts `chmod 0600` on the DB file (ignored if the FS does not support it) — keep the data directory private on the host as well
- Back up the DB file regularly; it holds leads, notes, password hashes, sessions, import jobs
- Restoring = stop app, replace DB files, start app (schema migrates on open)

## Auth hygiene (v0.3)

- Register / Team create: password **minimum 10** characters
- Login + register: soft in-memory rate limit ≤10 failures / 15 minutes per IP (and per-email for login) → HTTP **429** with `Retry-After` (single-node only; not shared across replicas)

## Health & rollback

- No dedicated `/api/health` route in this codebase.
- Smoke check: `GET /login` returns 200; after auth, `GET /api/auth/me` returns the user.
- Rollback: redeploy previous release tag / build artifact; restore SQLite backup if schema/data changed.

## Domains & TLS

Terminate TLS at your reverse proxy or platform. Prefer Secure cookies on HTTPS. Do not invent a hostname for docs — bind whatever domain your host assigns.

## Publish record

See [PUBLISH.md](./PUBLISH.md) for the factory publish checklist / first GitHub release notes (v0.1.0). Application version in `package.json` is **0.3.0**.
