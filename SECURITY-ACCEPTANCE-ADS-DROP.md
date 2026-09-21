# Security risk acceptance — Ads Drop (v0.2)

**Date:** 2026-09-21 (Asia/Karachi)  
**Accepted by:** Master Orchestrator on behalf of Olivia’s autonomous factory policy (demo / public source publish)  
**Report:** `SECURITY-REPORT-ADS-DROP.md`

## H1 — `xlsx@0.18.5` HIGH (no npm fix)

**Decision:** **ACCEPT for GitHub source + local/demo use.**

- CSV remains fully supported and recommended for untrusted uploads.
- XLSX kept for Meta Ads Manager exports convenience; size/row caps remain.
- **Not accepted** for multi-tenant internet-facing production until parser replaced or vendor fix.
- Revisit when swapping to a maintained parser.

## M1 / M2

**Decision:** **FIX before publish** (authz note-on-match + lead_id redaction for agents).

## M3+

Track as post-v0.2 hardening; not blocking demo GitHub tag after M1/M2.
