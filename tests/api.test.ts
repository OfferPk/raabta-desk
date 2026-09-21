import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const tmpDb = path.join(process.cwd(), "data", "test-api.db");

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

describe("API authz + validation (F7)", () => {
  let ownerId: string;
  let agentId: string;
  let ownerLeadId: string;
  let agentLeadId: string;
  let ownerSession: string;
  let agentSession: string;

  let getLead: typeof import("@/app/api/leads/[id]/route").GET;
  let patchLead: typeof import("@/app/api/leads/[id]/route").PATCH;
  let postLead: typeof import("@/app/api/leads/route").POST;
  let exportCsv: typeof import("@/app/api/export/leads.csv/route").GET;
  let closeDb: typeof import("@/lib/db").closeDb;
  let getDb: typeof import("@/lib/db").getDb;
  let csvEscape: typeof import("@/lib/csv").csvEscape;

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

    const ownerHash = bcrypt.hashSync("owner123", 10);
    const agentHash = bcrypt.hashSync("agent123", 10);

    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(ownerId, "owner@test.local", ownerHash, "Owner", "owner", now);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(agentId, "agent@test.local", agentHash, "Agent", "agent", now);

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    db.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).run(ownerSession, ownerId, expires.toISOString());
    db.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).run(agentSession, agentId, expires.toISOString());

    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at)
       VALUES (?, ?, ?, null, 'WA', 'new', ?, 0, 'PKR', null, ?, ?)`
    ).run(ownerLeadId, "Owner Lead", "923001111111", ownerId, now, now);
    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at)
       VALUES (?, ?, ?, null, 'WA', 'new', ?, 0, 'PKR', null, ?, ?)`
    ).run(agentLeadId, "Agent Lead", "923002222222", agentId, now, now);

    const leadRoutes = await import("@/app/api/leads/[id]/route");
    getLead = leadRoutes.GET;
    patchLead = leadRoutes.PATCH;
    postLead = (await import("@/app/api/leads/route")).POST;
    exportCsv = (await import("@/app/api/export/leads.csv/route")).GET;
    csvEscape = (await import("@/lib/csv")).csvEscape;
  });

  afterAll(() => {
    closeDb();
    cleanupDbFiles();
  });

  beforeEach(() => {
    sessionCookie = undefined;
  });

  function req(url: string, init?: RequestInit) {
    return new Request(url, init) as unknown as import("next/server").NextRequest;
  }

  it("agent gets 403 on foreign lead GET", async () => {
    sessionCookie = agentSession;
    const res = await getLead(req("http://localhost/api/leads/" + ownerLeadId), {
      params: Promise.resolve({ id: ownerLeadId }),
    });
    expect(res.status).toBe(403);
  });

  it("agent gets 403 on CSV export", async () => {
    sessionCookie = agentSession;
    const res = await exportCsv();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/owners only/i);
  });

  it("owner gets 200 on CSV export", async () => {
    sessionCookie = ownerSession;
    const res = await exportCsv();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Owner Lead");
    expect(res.headers.get("Content-Type")).toMatch(/text\/csv/);
  });

  it("empty PATCH name returns 400", async () => {
    sessionCookie = agentSession;
    const res = await patchLead(
      req("http://localhost/api/leads/" + agentLeadId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  " }),
      }),
      { params: Promise.resolve({ id: agentLeadId }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Name and phone are required/i);
  });

  it("short phone on create returns 400", async () => {
    sessionCookie = agentSession;
    const res = await postLead(
      req("http://localhost/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tiny", phone: "123" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/country code|92300/i);
  });

  it("csvEscape prefixes formula-like cells", () => {
    expect(csvEscape("=CMD")).toBe("'=CMD");
    expect(csvEscape("+1")).toBe("'+1");
    expect(csvEscape("-total")).toBe("'-total");
    expect(csvEscape("@sum")).toBe("'@sum");
    expect(csvEscape("normal")).toBe("normal");
  });
});
