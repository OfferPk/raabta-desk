# Setup — Raabta Desk

## Prerequisites

- **Node.js 20+** (LTS recommended) — https://nodejs.org  
  Check: `node -v` and `npm -v`
- Modern browser (Chrome / Edge / Firefox)
- Optional: Git (to clone)

Native module `better-sqlite3` needs a working build toolchain on first `npm install` (usual Node LTS installs include what you need on macOS/Linux; Windows may need build tools).

## Install

```bash
git clone https://github.com/OfferPk/raabta-desk.git
cd raabta-desk
npm install
```

Or from a factory checkout:

```bash
cd /workspace/factory/projects/raabta-desk
npm install
```

## Environment

```bash
cp .env.example .env.local
```

Defaults work for local development. See [CONFIGURATION.md](./CONFIGURATION.md).

For **production-style** `npm run build && npm start` over plain `http://localhost`, set in `.env.local`:

```bash
COOKIE_SECURE=false
```

## Database / seed

SQLite file is created automatically under `data/` (default `./data/raabta.db`). There is no separate migration CLI — schema runs on first DB open.

```bash
npm run seed
```

`seed` **deletes** the existing DB (and WAL/SHM) and loads demo users + sample leads/notes.

Reset anytime:

```bash
npm run db:reset
```

### Demo logins (after seed)

| Role  | Email              | Password  |
|-------|--------------------|-----------|
| Owner | owner@raabta.local | owner123  |
| Agent | agent@raabta.local | agent123  |

Labeled **demo** credentials for local try-out only — change before any public deploy.

Without seed: open `/register` — the **first** user becomes Owner; further public register is blocked (agents via Team).

## Run locally

Development:

```bash
npm run dev
```

App: **http://localhost:3000**

Production build locally:

```bash
npm run build
# ensure COOKIE_SECURE=false for HTTP
npm start
```

## Verify

```bash
npm test
```

Runs Vitest (phone + smoke + API authz/validation + Ads Drop import tests).

Also useful:

```bash
npm run build
```

## Ads Drop sample

Fixture files for manual try-out:

- `fixtures/meta-leads-sample.csv`
- `fixtures/meta-leads-sample.xlsx`

After login, open **Ads Drop** (`/imports`) and upload one of these.

## Common issues

| Symptom | Fix |
|---------|-----|
| `npm install` fails on `better-sqlite3` | Use Node 20+; install OS build tools; retry clean `rm -rf node_modules && npm install` |
| Login cookie missing after `npm start` on HTTP | Set `COOKIE_SECURE=false` in `.env.local` |
| Port 3000 in use | `npm run dev -- -p 3001` |
| Need clean demo data | `npm run seed` (wipes DB) |
| Agent cannot export CSV | By design — owners only |
