import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const tmpDb = path.join(process.cwd(), "data", "test-leads-filters.db");

function cleanupDbFiles() {
  for (const s of ["", "-wal", "-shm"]) {
    const p = tmpDb + s;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

let sessionCookie: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "raabta_session" && sessionCookie
        ? { value: sessionCookie }
        : undefined,
    set: () => {},
  }),
}));

describe("Leads list filters + authz", () => {
  let ownerId: string;
  let agentId: string;
  let ownerLeadId: string;
  let agentLeadId: string;
  let ownerSession: string;
  let agentSession: string;
  let getLeads: typeof import("@/app/api/leads/route").GET;
  let closeDb: typeof import("@/lib/db").closeDb;
  let getDb: typeof import("@/lib/db").getDb;

  beforeAll(async () => {
    cleanupDbFiles();
    fs.mkdirSync(path.dirname(tmpDb), { recursive: true });
    process.env.DATABASE_PATH = tmpDb;

    const dbMod = await import("@/lib/db");
    closeDb = dbMod.closeDb;
    getDb = dbMod.getDb;
    closeDb();
    const db = getDb();
    const now = new Date().toISOString();
    ownerId = crypto.randomUUID();
    agentId = crypto.randomUUID();
    ownerLeadId = crypto.randomUUID();
    agentLeadId = crypto.randomUUID();
    ownerSession = crypto.randomUUID();
    agentSession = crypto.randomUUID();

    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(ownerId, "o@f.local", bcrypt.hashSync("password12", 10), "Owner", "owner", now);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(agentId, "a@f.local", bcrypt.hashSync("password12", 10), "Agent", "agent", now);

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
      ownerSession,
      ownerId,
      expires.toISOString()
    );
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
      agentSession,
      agentId,
      expires.toISOString()
    );

    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at, meta_campaign, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'PKR', null, ?, ?, ?, NULL)`
    ).run(
      ownerLeadId,
      "Meta Ali",
      "923009990001",
      "ali@x.com",
      "meta_ads",
      "new",
      ownerId,
      now,
      now,
      "Summer Sale"
    );
    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at, meta_campaign, archived_at)
       VALUES (?, ?, ?, null, ?, ?, ?, 0, 'PKR', null, ?, ?, null, NULL)`
    ).run(agentLeadId, "Walkin Sara", "923009990002", "walkin", "qualified", agentId, now, now);

    getLeads = (await import("@/app/api/leads/route")).GET;
  });

  afterAll(() => {
    closeDb();
    cleanupDbFiles();
  });

  beforeEach(() => {
    sessionCookie = undefined;
  });

  function req(url: string) {
    const { NextRequest } = require("next/server") as typeof import("next/server");
    return new NextRequest(url);
  }

  it("filters by q / source / campaign", async () => {
    sessionCookie = ownerSession;
    const byQ = await (await getLeads(req("http://localhost/api/leads?q=ali"))).json();
    expect(byQ.leads).toHaveLength(1);
    expect(byQ.leads[0].id).toBe(ownerLeadId);

    const bySource = await (
      await getLeads(req("http://localhost/api/leads?source=meta_ads"))
    ).json();
    expect(bySource.leads.every((l: { source: string }) => l.source === "meta_ads")).toBe(
      true
    );

    const byCamp = await (
      await getLeads(
        req("http://localhost/api/leads?meta_campaign=Summer%20Sale")
      )
    ).json();
    expect(byCamp.leads).toHaveLength(1);
  });

  it("agent cannot query other owners via owner_id (scoped to self)", async () => {
    sessionCookie = agentSession;
    const res = await getLeads(
      req(`http://localhost/api/leads?owner_id=${ownerId}`)
    );
    const body = await res.json();
    expect(body.leads.every((l: { owner_id: string }) => l.owner_id === agentId)).toBe(
      true
    );
    expect(body.leads.find((l: { id: string }) => l.id === ownerLeadId)).toBeUndefined();
  });

  it("owner can filter by owner_id", async () => {
    sessionCookie = ownerSession;
    const res = await getLeads(
      req(`http://localhost/api/leads?owner_id=${agentId}`)
    );
    const body = await res.json();
    expect(body.leads).toHaveLength(1);
    expect(body.leads[0].id).toBe(agentLeadId);
  });
});
