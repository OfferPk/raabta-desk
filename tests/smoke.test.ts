import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { normalizePhoneDigits, toWhatsAppUrl } from "../src/lib/phone";

/**
 * Smoke: seed a temp SQLite DB, insert lead, verify follow-up filter + wa.me.
 * Does not boot Next.js — validates core data path used by the app.
 */
const tmpDb = path.join(process.cwd(), "data", "test-smoke.db");

function cleanup() {
  for (const s of ["", "-wal", "-shm"]) {
    const p = tmpDb + s;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

describe("smoke: auth hash + lead + follow-up + wa.me", () => {
  let db: Database.Database;
  const ownerId = "owner-1";
  const leadOverdueId = "lead-overdue";
  const leadFutureId = "lead-future";

  beforeAll(() => {
    cleanup();
    fs.mkdirSync(path.dirname(tmpDb), { recursive: true });
    db = new Database(tmpDb);
    db.pragma("foreign_keys = ON");
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        source TEXT,
        stage TEXT NOT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id),
        value_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'PKR',
        next_follow_up TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const hash = bcrypt.hashSync("owner123", 10);
    expect(bcrypt.compareSync("owner123", hash)).toBe(true);
    expect(bcrypt.compareSync("wrong", hash)).toBe(false);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)`
    ).run(ownerId, "owner@test.local", hash, "Owner", "owner", now);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at)
       VALUES (?, ?, ?, null, 'WA', 'follow_up', ?, 1000000, 'PKR', ?, ?, ?)`
    ).run(
      leadOverdueId,
      "Overdue Lead",
      "923001112233",
      ownerId,
      yesterday.toISOString(),
      now,
      now
    );

    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at)
       VALUES (?, ?, ?, null, 'WA', 'new', ?, 500000, 'PKR', ?, ?, ?)`
    ).run(
      leadFutureId,
      "Future Lead",
      "03001234567",
      ownerId,
      nextWeek.toISOString(),
      now,
      now
    );
  });

  afterAll(() => {
    db.close();
    cleanup();
  });

  it("lists due today + overdue correctly", () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const rows = db
      .prepare(
        `SELECT id FROM leads
         WHERE next_follow_up IS NOT NULL
           AND next_follow_up <= ?
           AND stage NOT IN ('won', 'lost')`
      )
      .all(end.toISOString()) as { id: string }[];
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(leadOverdueId);
    expect(ids).not.toContain(leadFutureId);
  });

  it("normalizes phone for WhatsApp", () => {
    const lead = db
      .prepare("SELECT phone FROM leads WHERE id = ?")
      .get(leadOverdueId) as { phone: string };
    expect(normalizePhoneDigits(lead.phone)).toBe("923001112233");
    expect(toWhatsAppUrl(lead.phone)).toBe("https://wa.me/923001112233");
  });

  it("sums open pipeline value", () => {
    const row = db
      .prepare(
        `SELECT SUM(value_cents) as s FROM leads
         WHERE stage IN ('new', 'qualified', 'follow_up')`
      )
      .get() as { s: number };
    expect(row.s).toBe(1500000);
  });
});
