# Publish record — Raabta Desk

| Field | Value |
|-------|-------|
| **Repo URL** | https://github.com/OfferPk/raabta-desk |
| **Visibility** | public |
| **Default branch** | main |
| **Commit SHA** | `1d9812cf939ec970af65c644567255a6f1fe827b` |
| **Release** | [v0.1.0](https://github.com/OfferPk/raabta-desk/releases/tag/v0.1.0) |
| **Published at** | 2026-09-21 17:02:31 PKT (Asia/Karachi) |
| **Publisher** | GitHub Manager via `gh-factory` (login OfferPk) |

## Pre-publish checks

| Check | Result |
|-------|--------|
| `npm test` | **PASS** — 18/18 (phone, smoke, api) |
| `npm run build` | **PASS** — Next.js 15.5.25 |
| `npm audit --omit=dev` | **0 critical / 0 high** (0 total) |
| `.gitignore` | Includes `node_modules`, `.next`, `.env*`, `data/*.db*`, `*.db`, `.env.local` |
| Secrets staged | **None** — `.env.local` and `data/*.db*` untracked |
| README | Run instructions + demo logins labeled **Demo** |
| LICENSE | MIT added |

## Audit summary

- **Critical:** 0  
- **High:** 0  
- Prior SECURITY-REPORT H1 (next@14 / postcss) resolved by Next **15.5.25** + postcss override before publish.

## Notes

- Original MVP code only; demo seed credentials documented for local use.
- Do not commit `.env.local` or SQLite DB files.
