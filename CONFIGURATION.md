# Configuration — Raabta Desk

All environment-specific values live in env vars. Never commit real secrets. Documented values match `.env.example` only.

## Variables (from `.env.example`)

| Variable | Required? | Default / example | Description |
|----------|-----------|-------------------|-------------|
| `DATABASE_PATH` | No | `./data/raabta.db` | SQLite file path. Relative paths resolve from the project working directory; absolute paths are used as-is (`src/lib/db.ts`). |
| `SESSION_SECRET` | No | placeholder string | **Reserved / unused in MVP.** Sessions are random UUIDs stored in the `sessions` table; kept for a future signed-cookie upgrade. Do not treat as active HMAC secret today. |
| `COOKIE_SECURE` | No | `false` in example | Controls the session cookie `Secure` flag (`src/lib/auth.ts` → `shouldUseSecureCookie`): |
| | | | • `false` or `0` — never Secure (**use for local HTTP** `npm run build && npm start`) |
| | | | • `true` or `1` — always Secure (recommended behind real HTTPS) |
| | | | • **unset** — Secure when `NODE_ENV=production`, or when the request has `x-forwarded-proto: https` (first value if comma-separated) |
| `NODE_ENV` | No | `development` in example | Standard Node/Next environment. Affects default Secure cookie behavior when `COOKIE_SECURE` is unset. Set by Next/`npm start` in production mode. |

## Files

| File | Purpose | Commit? |
|------|---------|---------|
| `.env.example` | Documented placeholders | yes |
| `.env.local` | Local overrides / secrets | **no** (gitignored) |
| `data/*.db*` | SQLite database + WAL | **no** (gitignored) |

## Environments

| Env | Notes |
|-----|-------|
| Development (`npm run dev`) | Defaults work; Secure cookie usually off because `NODE_ENV` is not `production`. |
| Local production (`npm run build && npm start` on HTTP) | Set `COOKIE_SECURE=false` or browsers drop the session cookie. |
| Real HTTPS deploy | Prefer `COOKIE_SECURE=true`, or leave unset and terminate TLS so `x-forwarded-proto: https` is set. |

## Non-env limits (code constants)

Not env vars — documented so operators know hard limits:

| Limit | Value | Source |
|-------|-------|--------|
| Import file size | 5 MB | `MAX_IMPORT_BYTES` in `src/lib/import-parse.ts` |
| Import data rows | 2,000 | `MAX_IMPORT_ROWS` |
| Note body | 5,000 chars | notes API / imports |
| Session lifetime | 14 days | `SESSION_DAYS` in `src/lib/auth.ts` |
| Cookie name | `raabta_session` | `src/lib/auth.ts` |
