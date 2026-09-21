# Raabta Desk — User guide

## What it is

A shared desk so sales inquiries do not die in personal WhatsApp chats. Your team captures leads once, sees who owns what, and knows what is due today.

## Roles

- **Owner** — sees all leads, exports CSV, manages Team (create agents).
- **Agent** — sees and edits own leads; can create new leads assigned to self.

## Typical day

1. Sign in.
2. Check **Dashboard** for overdue count and open pipeline value.
3. Open **Follow-ups** — call/WhatsApp each item, add a note, mark Done or snooze Tomorrow.
4. Capture new inquiries on **New lead** (phone with country code `92…`).
5. Move deals on the **Board** as conversations progress.

## WhatsApp

The WhatsApp button opens `https://wa.me/<digits>` in a new tab. Digits are stripped from the phone field. Prefer international format (`92300…`) over local `03…`.

## Notes

Notes are append-only. Use them after every meaningful chat so the next teammate has context.

## Export

Owners can download all leads as CSV from the nav (**Export CSV**) or `/api/export/leads.csv`.


## Ads Drop

For teams buying Meta Lead Ads: download the leads CSV/XLSX from Ads Manager, then use **Ads Drop** in Raabta.

- Map Meta columns to name / phone / email / meta lead id / campaign (or append Q&A to an import note)
- Phone is required and normalized the same way as manual leads (`03…` → `92…`)
- Dedupe by Meta lead id, then by phone; optional “note on phone match”
- Commit creates shared desk leads (`source=meta_ads`) and can nudge them into **Follow-ups** immediately
- Save a mapping preset so the next weekly download maps itself when headers match

This does **not** connect to Meta’s Marketing API or WhatsApp Business API — it only reads the file you upload.
