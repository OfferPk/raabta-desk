import { createHash } from "crypto";
import type { MapTarget } from "./types";
import { MAP_TARGETS } from "./types";

/** sha256 of sorted lowercased headers joined by \\n */
export function headerFingerprint(headers: string[]): string {
  const normalized = headers
    .map((h) => h.trim().toLowerCase())
    .sort()
    .join("\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

const ALIASES: Record<string, MapTarget> = {
  id: "meta_lead_id",
  lead_id: "meta_lead_id",
  meta_lead_id: "meta_lead_id",
  created_time: "created_at",
  created_at: "created_at",
  campaign_name: "meta_campaign",
  meta_campaign: "meta_campaign",
  full_name: "name",
  name: "name",
  first_name: "name",
  last_name: "name",
  phone_number: "phone",
  phone: "phone",
  mobile: "phone",
  email: "email",
  email_address: "email",
};

const NOTE_DEFAULTS = new Set([
  "campaign_id",
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "form_id",
  "form_name",
  "is_organic",
  "platform",
]);

export function defaultMapping(headers: string[]): Record<string, MapTarget> {
  const mapping: Record<string, MapTarget> = {};
  let phoneAssigned = false;
  let nameAssigned = false;
  let metaIdAssigned = false;
  let campaignAssigned = false;
  let createdAssigned = false;
  let emailAssigned = false;

  // Prefer full_name over first/last for name
  const lowerHeaders = headers.map((h) => ({
    raw: h,
    key: h.trim().toLowerCase(),
  }));

  for (const { raw, key } of lowerHeaders) {
    const alias = ALIASES[key];
    if (alias === "phone" && !phoneAssigned) {
      mapping[raw] = "phone";
      phoneAssigned = true;
      continue;
    }
    if (alias === "meta_lead_id" && !metaIdAssigned) {
      mapping[raw] = "meta_lead_id";
      metaIdAssigned = true;
      continue;
    }
    if (alias === "meta_campaign" && !campaignAssigned) {
      mapping[raw] = "meta_campaign";
      campaignAssigned = true;
      continue;
    }
    if (alias === "created_at" && !createdAssigned) {
      mapping[raw] = "created_at";
      createdAssigned = true;
      continue;
    }
    if (alias === "email" && !emailAssigned) {
      mapping[raw] = "email";
      emailAssigned = true;
      continue;
    }
    if (alias === "name") {
      if (key === "full_name" || key === "name") {
        if (!nameAssigned) {
          mapping[raw] = "name";
          nameAssigned = true;
        } else {
          mapping[raw] = "note";
        }
      } else if (key === "first_name" || key === "last_name") {
        // defer — handled below if no full_name
        continue;
      }
      continue;
    }
    if (NOTE_DEFAULTS.has(key)) {
      mapping[raw] = "note";
      continue;
    }
    // custom / unknown → note
    if (!(raw in mapping)) {
      mapping[raw] = "note";
    }
  }

  // first_name + last_name → both map to name (joined on commit) if no full_name/name
  if (!nameAssigned) {
    const first = lowerHeaders.find((h) => h.key === "first_name");
    const last = lowerHeaders.find((h) => h.key === "last_name");
    if (first) {
      mapping[first.raw] = "name";
      nameAssigned = true;
    }
    if (last) {
      mapping[last.raw] = "name";
      nameAssigned = true;
    }
  } else {
    for (const { raw, key } of lowerHeaders) {
      if (key === "first_name" || key === "last_name") {
        if (!mapping[raw] || mapping[raw] === "note") mapping[raw] = "note";
      }
    }
  }

  // ensure every header has a target
  for (const h of headers) {
    if (!(h in mapping)) mapping[h] = "note";
  }

  return mapping;
}

export function isValidMapTarget(v: unknown): v is MapTarget {
  return typeof v === "string" && (MAP_TARGETS as string[]).includes(v);
}

export function validateMapping(
  mapping: Record<string, MapTarget>
): { ok: true } | { ok: false; error: string } {
  const phoneCols = Object.entries(mapping).filter(([, t]) => t === "phone");
  if (phoneCols.length === 0) {
    return { ok: false, error: "Map exactly one column to phone" };
  }
  if (phoneCols.length > 1) {
    return { ok: false, error: "Map exactly one column to phone" };
  }
  return { ok: true };
}

/** Parse Meta/ISO-ish timestamps; return ISO string or null. */
export function parseMetaTimestamp(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  // Meta often: 2026-09-20T10:15:00+0000 (no colon in offset)
  const fixed = s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const d = new Date(fixed);
  if (Number.isNaN(d.getTime())) {
    const d2 = new Date(s);
    if (Number.isNaN(d2.getTime())) return null;
    return d2.toISOString();
  }
  return d.toISOString();
}
