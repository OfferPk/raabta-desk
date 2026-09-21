import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const tmpDb = path.join(process.cwd(), "data", "test-v03.db");

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

describe("v0.3 soft-archive + settings + sample", () => {
  let ownerId: string;
  let agentId: string;
  let ownerLeadId: string;
  let wonLeadId: string;
  let ownerSession: string;
  let agentSession: string;

  let patchLead: typeof import("@/app/api/leads/[id]/route").PATCH;
  let getLeads: typeof import("@/app/api/leads/route").GET;
  let postSample: typeof import("@/app/api/leads/sample/route").POST;
  let getSettings: typeof import("@/app/api/settings/route").GET;
  let patchSettings: typeof import("@/app/api/settings/route").PATCH;
  let closeDb: typeof import("@/lib/db").closeDb;
  let getDb: typeof import("@/lib/db").getDb;
  let listLeads: typeof import("@/lib/leads").listLeads;
  let getDashboardStats: typeof import("@/lib/leads").getDashboardStats;
  let followUpQueue: typeof import("@/lib/leads").followUpQueue;

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
    wonLeadId = crypto.randomUUID();
    ownerSession = crypto.randomUUID();
    agentSession = crypto.randomUUID();

    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(ownerId, "owner-v03@test.local", bcrypt.hashSync("owner123", 10), "Owner", "owner", now);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(agentId, "agent-v03@test.local", bcrypt.hashSync("agent123", 10), "Agent", "agent", now);

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
      ownerSession, ownerId, expires.toISOString()
    );
    db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
      agentSession, agentId, expires.toISOString()
    );

    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at)
       VALUES (?, ?, ?, null, 'WA', 'new', ?, 100000, 'PKR', ?, ?, ?)`
    ).run(ownerLeadId, "Active Lead", "923003333333", ownerId, now, now, now);

    const overdue = new Date();
    overdue.setDate(overdue.getDate() - 2);
    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at)
       VALUES (?, ?, ?, null, 'WA', 'won', ?, 250000, 'PKR', null, ?, ?)`
    ).run(wonLeadId, "Won Lead", "923004444444", ownerId, now, now);

    patchLead = (await import("@/app/api/leads/[id]/route")).PATCH;
    getLeads = (await import("@/app/api/leads/route")).GET;
    postSample = (await import("@/app/api/leads/sample/route")).POST;
    const settings = await import("@/app/api/settings/route");
    getSettings = settings.GET;
    patchSettings = settings.PATCH;
    const leadsMod = await import("@/lib/leads");
    listLeads = leadsMod.listLeads;
    getDashboardStats = leadsMod.getDashboardStats;
    followUpQueue = leadsMod.followUpQueue;
  });

  afterAll(() => {
    closeDb();
    cleanupDbFiles();
  });

  beforeEach(() => {
    sessionCookie = undefined;
  });

  function req(url: string, init?: RequestInit) {
    const { NextRequest } = require("next/server") as typeof import("next/server");
    return new NextRequest(url, init);
  }

  it("archives lead via PATCH and hides from default list", async () => {
    sessionCookie = ownerSession;
    const res = await patchLead(
      req("http://localhost/api/leads/" + wonLeadId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      }),
      { params: Promise.resolve({ id: wonLeadId }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lead.archived_at).toBeTruthy();

    const active = listLeads();
    expect(active.find((l) => l.id === wonLeadId)).toBeUndefined();
    expect(active.find((l) => l.id === ownerLeadId)).toBeTruthy();

    const withArchived = listLeads({ includeArchived: true });
    expect(withArchived.find((l) => l.id === wonLeadId)?.archived_at).toBeTruthy();

    const only = listLeads({ archivedOnly: true });
    expect(only.every((l) => l.archived_at)).toBe(true);
    expect(only.find((l) => l.id === wonLeadId)).toBeTruthy();
  });

  it("GET /api/leads?archived=1 includes archived", async () => {
    sessionCookie = ownerSession;
    const res = await getLeads(req("http://localhost/api/leads?archived=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leads.some((l: { id: string }) => l.id === wonLeadId)).toBe(true);
  });

  it("unarchives lead", async () => {
    sessionCookie = ownerSession;
    const res = await patchLead(
      req("http://localhost/api/leads/" + wonLeadId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      }),
      { params: Promise.resolve({ id: wonLeadId }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lead.archived_at).toBeNull();
    // re-archive for remaining isolation
    await patchLead(
      req("http://localhost/api/leads/" + wonLeadId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      }),
      { params: Promise.resolve({ id: wonLeadId }) }
    );
  });

  it("follow-up queue excludes archived", async () => {
    const db = getDb();
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const archivedFu = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, null, 'WA', 'follow_up', ?, 0, 'PKR', ?, ?, ?, ?)`
    ).run(
      archivedFu,
      "Archived FU",
      "923005555555",
      ownerId,
      past.toISOString(),
      now,
      now,
      now
    );
    const q = followUpQueue();
    expect(q.find((l) => l.id === archivedFu)).toBeUndefined();
  });

  it("dashboard stats exclude archived and expose cadence fields", () => {
    const stats = getDashboardStats();
    expect(stats.archived_count).toBeGreaterThanOrEqual(1);
    expect(stats.total_leads).toBeGreaterThanOrEqual(1);
    expect(stats.import_remind_days).toBe(3);
    expect(typeof stats.import_cadence_due).toBe("boolean");
    expect(typeof stats.stale_leads).toBe("number");
    expect(typeof stats.overdue_value_cents).toBe("number");
    expect(typeof stats.imports_this_week).toBe("number");
  });

  it("owner can set import_remind_days", async () => {
    sessionCookie = ownerSession;
    const res = await patchSettings(
      req("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import_remind_days: 5 }),
      }) as import("next/server").NextRequest
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.import_remind_days).toBe(5);

    const get = await getSettings();
    expect(get.status).toBe(200);
    const g = await get.json();
    expect(g.import_remind_days).toBe(5);

    // restore default
    await patchSettings(
      req("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import_remind_days: 3 }),
      }) as import("next/server").NextRequest
    );
  });

  it("agent cannot change import_remind_days", async () => {
    sessionCookie = agentSession;
    const res = await patchSettings(
      req("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import_remind_days: 9 }),
      }) as import("next/server").NextRequest
    );
    expect(res.status).toBe(403);
  });

  it("dismiss onboarding setting", async () => {
    sessionCookie = agentSession;
    const res = await patchSettings(
      req("http://localhost/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_dismissed: true }),
      }) as import("next/server").NextRequest
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onboarding_dismissed).toBe(true);
  });


  it("agent can archive own lead; cannot archive foreign (authz)", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const agentLeadId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at)
       VALUES (?, ?, ?, null, 'WA', 'new', ?, 0, 'PKR', null, ?, ?)`
    ).run(agentLeadId, "Agent Own", "923006666666", agentId, now, now);

    sessionCookie = agentSession;
    const own = await patchLead(
      req("http://localhost/api/leads/" + agentLeadId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      }),
      { params: Promise.resolve({ id: agentLeadId }) }
    );
    expect(own.status).toBe(200);
    expect((await own.json()).lead.archived_at).toBeTruthy();

    const foreign = await patchLead(
      req("http://localhost/api/leads/" + ownerLeadId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      }),
      { params: Promise.resolve({ id: ownerLeadId }) }
    );
    expect(foreign.status).toBe(403);
  });

  it("sample lead CTA creates lead + note", async () => {
    sessionCookie = ownerSession;
    const res = await postSample();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.lead.name).toMatch(/Sample/i);
    expect(body.lead.source).toBe("sample");
  });
});
