import { getDb } from "./db";

const DEFAULT_IMPORT_REMIND_DAYS = 3;
const DEFAULT_STALE_DAYS = 7;

export function getSetting(key: string, fallback = ""): string {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM workspace_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO workspace_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, now);
}

export function getImportRemindDays(): number {
  const raw = getSetting("import_remind_days", String(DEFAULT_IMPORT_REMIND_DAYS));
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 90) return DEFAULT_IMPORT_REMIND_DAYS;
  return Math.round(n);
}

export function setImportRemindDays(days: number): number {
  const n = Math.max(1, Math.min(90, Math.round(Number(days) || DEFAULT_IMPORT_REMIND_DAYS)));
  setSetting("import_remind_days", String(n));
  return n;
}

export function getStaleDays(): number {
  const raw = getSetting("stale_days", String(DEFAULT_STALE_DAYS));
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 90) return DEFAULT_STALE_DAYS;
  return Math.round(n);
}

export function isOnboardingDismissed(userId: string): boolean {
  return getSetting(`onboarding_dismissed:${userId}`, "") === "1";
}

export function setOnboardingDismissed(userId: string, dismissed: boolean): void {
  setSetting(`onboarding_dismissed:${userId}`, dismissed ? "1" : "0");
}
