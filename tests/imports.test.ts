import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const tmpDb = path.join(process.cwd(), "data", "test-imports.db");
const fixtureCsv = path.join(process.cwd(), "fixtures", "meta-leads-sample.csv");
const fixtureXlsx = path.join(
  process.cwd(),
  "fixtures",
  "meta-leads-sample.xlsx"
);

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

describe("Ads Drop imports", () => {
  let ownerId: string;
  let agentId: string;
  let ownerSession: string;
  let agentSession: string;
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
    ownerSession = crypto.randomUUID();
    agentSession = crypto.randomUUID();

    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      ownerId,
      "owner@import.local",
      bcrypt.hashSync("owner123", 10),
      "Owner",
      "owner",
      now
    );
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      agentId,
      "agent@import.local",
      bcrypt.hashSync("agent123", 10),
      "Agent",
      "agent",
      now
    );

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    db.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).run(ownerSession, ownerId, expires.toISOString());
    db.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).run(agentSession, agentId, expires.toISOString());

    // Seed lead matching fixture phone 923001111111 for dupe-phone tests
    db.prepare(
      `INSERT INTO leads
        (id, name, phone, email, source, stage, owner_id, value_cents, currency,
         next_follow_up, created_at, updated_at)
       VALUES (?, ?, ?, null, 'WA', 'new', ?, 0, 'PKR', null, ?, ?)`
    ).run(
      crypto.randomUUID(),
      "Existing Phone Lead",
      "923001111111",
      ownerId,
      now,
      now
    );
  });

  afterAll(() => {
    closeDb();
    cleanupDbFiles();
  });

  beforeEach(() => {
    sessionCookie = ownerSession;
  });

  it("parses CSV with quoted commas and Meta headers", async () => {
    const { parseCsvBuffer } = await import("@/lib/import-parse");
    const csv = `id,full_name,phone_number,note\n"a1","Khan, Ali","03001110001","hello, world"\n`;
    const parsed = parseCsvBuffer(csv);
    expect(parsed.headers).toEqual([
      "id",
      "full_name",
      "phone_number",
      "note",
    ]);
    expect(parsed.rows[0].full_name).toBe("Khan, Ali");
    expect(parsed.rows[0].note).toBe("hello, world");
  });

  it("parses XLSX first sheet from fixture", async () => {
    const { parseImportFile } = await import("@/lib/import-parse");
    const buf = fs.readFileSync(fixtureXlsx);
    const parsed = parseImportFile("meta-leads-sample.xlsx", buf);
    expect(parsed.headers).toContain("phone_number");
    expect(parsed.rows.length).toBeGreaterThanOrEqual(4);
  });

  it("rejects empty / oversized / too many rows", async () => {
    const { parseImportFile, ParseError, MAX_IMPORT_ROWS } = await import(
      "@/lib/import-parse"
    );
    expect(() => parseImportFile("x.csv", Buffer.from(""))).toThrow(ParseError);

    const huge = Buffer.alloc(5 * 1024 * 1024 + 1, 0x61);
    expect(() => parseImportFile("x.csv", huge)).toThrow(/5 MB/);

    const lines = ["id,phone_number"];
    for (let i = 0; i < MAX_IMPORT_ROWS + 1; i++) {
      lines.push(`id${i},9230011100${String(i).padStart(2, "0")}`);
    }
    expect(() =>
      parseImportFile("x.csv", Buffer.from(lines.join("\n")))
    ).toThrow(/Too many rows/);
  });

  it("fingerprint + Meta smart defaults", async () => {
    const { headerFingerprint, defaultMapping } = await import(
      "@/lib/import-map"
    );
    const headers = [
      "id",
      "created_time",
      "campaign_name",
      "full_name",
      "phone_number",
      "email",
      "custom_q",
    ];
    const fp1 = headerFingerprint(headers);
    const fp2 = headerFingerprint([...headers].reverse());
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);

    const m = defaultMapping(headers);
    expect(m.id).toBe("meta_lead_id");
    expect(m.phone_number).toBe("phone");
    expect(m.full_name).toBe("name");
    expect(m.campaign_name).toBe("meta_campaign");
    expect(m.created_time).toBe("created_at");
    expect(m.email).toBe("email");
    expect(m.custom_q).toBe("note");
  });

  it("phone gate: 03… → 92…; blank/short invalid on commit", async () => {
    const { preparePhoneForStorage } = await import("@/lib/phone");
    expect(preparePhoneForStorage("03001234567")).toBe("923001234567");
    expect(preparePhoneForStorage("")).toBeNull();
    expect(preparePhoneForStorage("12345")).toBeNull();
  });

  it("commit happy path from fixture CSV", async () => {
    const { parseImportFile } = await import("@/lib/import-parse");
    const {
      createImportJob,
      updateMapping,
      commitJob,
      listJobRows,
    } = await import("@/lib/imports");
    const { getLead } = await import("@/lib/leads");
    const { defaultMapping } = await import("@/lib/import-map");

    const buf = fs.readFileSync(fixtureCsv);
    const parsed = parseImportFile("meta-leads-sample.csv", buf);
    const job = createImportJob({
      uploadedBy: ownerId,
      filename: "meta-leads-sample.csv",
      headers: parsed.headers,
      rows: parsed.rows,
    });

    // raw_json persisted
    const pending = listJobRows(job.id);
    expect(pending.length).toBe(parsed.rows.length);
    expect(pending[0].raw_json).toBeTruthy();
    expect(JSON.parse(pending[0].raw_json).id).toBeTruthy();

    const mapping = defaultMapping(parsed.headers);
    updateMapping(job.id, {
      id: ownerId,
      email: "owner@import.local",
      name: "Owner",
      role: "owner",
    }, {
      mapping,
      nudge_hours: 0,
      note_on_match: false,
    });

    const result = commitJob(
      job.id,
      {
        id: ownerId,
        email: "owner@import.local",
        name: "Owner",
        role: "owner",
      },
      true
    );

    expect(result.report.created).toBeGreaterThanOrEqual(1);
    expect(result.report.skipped_invalid).toBeGreaterThanOrEqual(2); // blank + short
    expect(result.report.skipped_dupes).toBeGreaterThanOrEqual(1); // seed phone

    const createdRow = listJobRows(job.id).find((r) => r.outcome === "created");
    expect(createdRow?.lead_id).toBeTruthy();
    const lead = getLead(createdRow!.lead_id!);
    expect(lead?.source).toBe("meta_ads");
    expect(lead?.stage).toBe("new");
    expect(lead?.meta_lead_id).toBeTruthy();
    expect(lead?.phone).toMatch(/^92/);
    expect(lead?.next_follow_up).toBeTruthy();
  });

  it("idempotency: second commit same meta ids → 0 created; HTTP 409", async () => {
    const { parseImportFile } = await import("@/lib/import-parse");
    const {
      createImportJob,
      updateMapping,
      commitJob,
      ImportError,
    } = await import("@/lib/imports");
    const { defaultMapping } = await import("@/lib/import-map");

    const buf = fs.readFileSync(fixtureCsv);
    const parsed = parseImportFile("meta-leads-sample.csv", buf);
    const mapping = defaultMapping(parsed.headers);

    const job2 = createImportJob({
      uploadedBy: ownerId,
      filename: "meta-leads-sample-rerun.csv",
      headers: parsed.headers,
      rows: parsed.rows,
    });
    const user = {
      id: ownerId,
      email: "owner@import.local",
      name: "Owner",
      role: "owner" as const,
    };
    updateMapping(job2.id, user, {
      mapping,
      nudge_hours: null,
      note_on_match: false,
    });
    const r2 = commitJob(job2.id, user, true);
    expect(r2.report.created).toBe(0);
    expect(r2.report.skipped_dupes).toBeGreaterThanOrEqual(1);

    expect(() => commitJob(job2.id, user, true)).toThrow(ImportError);
    try {
      commitJob(job2.id, user, true);
    } catch (e) {
      expect((e as InstanceType<typeof ImportError>).status).toBe(409);
    }

    // HTTP route 409
    sessionCookie = ownerSession;
    const { POST: commitRoute } = await import(
      "@/app/api/imports/[jobId]/commit/route"
    );
    const req = new Request(`http://localhost/api/imports/${job2.id}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    const res = await commitRoute(req as never, {
      params: Promise.resolve({ jobId: job2.id }),
    });
    expect(res.status).toBe(409);
  });

  it("note_on_match appends note without new lead", async () => {
    const {
      createImportJob,
      updateMapping,
      commitJob,
      listJobRows,
    } = await import("@/lib/imports");
    const { listNotes, findLeadByPhone } = await import("@/lib/leads");

    const headers = ["id", "full_name", "phone_number", "campaign_name"];
    const rows = [
      {
        id: "ml_note_match_1",
        full_name: "Note Matcher",
        phone_number: "923001111111",
        campaign_name: "Note Campaign",
      },
    ];
    const job = createImportJob({
      uploadedBy: ownerId,
      filename: "note-match.csv",
      headers,
      rows,
    });
    const user = {
      id: ownerId,
      email: "owner@import.local",
      name: "Owner",
      role: "owner" as const,
    };
    updateMapping(job.id, user, {
      mapping: {
        id: "meta_lead_id",
        full_name: "name",
        phone_number: "phone",
        campaign_name: "meta_campaign",
      },
      note_on_match: true,
      nudge_hours: null,
    });
    const before = findLeadByPhone("923001111111")!;
    const notesBefore = listNotes(before.id).length;
    const result = commitJob(job.id, user, true);
    expect(result.report.created).toBe(0);
    expect(result.report.note_on_match).toBe(1);
    const row = listJobRows(job.id)[0];
    expect(row.outcome).toBe("note_on_match");
    expect(listNotes(before.id).length).toBe(notesBefore + 1);
  });

  it("authz: unauthenticated 401; agent cannot read other job; agent owner forced", async () => {
    const { parseImportFile } = await import("@/lib/import-parse");
    const { createImportJob, updateMapping, getJob } = await import(
      "@/lib/imports"
    );
    const { defaultMapping } = await import("@/lib/import-map");

    const buf = fs.readFileSync(fixtureCsv);
    const parsed = parseImportFile("meta-leads-sample.csv", buf);
    const ownerJob = createImportJob({
      uploadedBy: ownerId,
      filename: "owner-only.csv",
      headers: parsed.headers.slice(0, 5),
      rows: parsed.rows.slice(0, 1),
    });

    sessionCookie = undefined;
    const { GET: listImports } = await import("@/app/api/imports/route");
    const unauth = await listImports();
    expect(unauth.status).toBe(401);

    sessionCookie = agentSession;
    const { GET: getJobRoute } = await import(
      "@/app/api/imports/[jobId]/route"
    );
    const forbidden = await getJobRoute(
      new Request(`http://localhost/api/imports/${ownerJob.id}`) as never,
      { params: Promise.resolve({ jobId: ownerJob.id }) }
    );
    expect(forbidden.status).toBe(403);

    // Agent creates job and tries to assign owner → forced to self
    const agentJob = createImportJob({
      uploadedBy: agentId,
      filename: "agent.csv",
      headers: ["id", "full_name", "phone_number"],
      rows: [
        {
          id: "ml_agent_1",
          full_name: "Agent Lead",
          phone_number: "923009990001",
        },
      ],
    });
    updateMapping(
      agentJob.id,
      {
        id: agentId,
        email: "agent@import.local",
        name: "Agent",
        role: "agent",
      },
      {
        mapping: defaultMapping(["id", "full_name", "phone_number"]),
        default_owner_id: ownerId, // should be ignored
        nudge_hours: 0,
      }
    );
    const updated = getJob(agentJob.id)!;
    expect(updated.default_owner_id).toBe(agentId);
  });
  it("AD-01: formatted DB phone matches normalized import digits", async () => {
    const { createLead, findLeadByPhone } = await import("@/lib/leads");
    const {
      createImportJob,
      updateMapping,
      commitJob,
      listJobRows,
      ImportError,
    } = await import("@/lib/imports");

    createLead({
      name: "Legacy Format",
      phone: "+92 300 7778899",
      owner_id: ownerId,
      source: "seed",
    });
    expect(findLeadByPhone("923007778899")?.name).toBe("Legacy Format");

    const job = createImportJob({
      uploadedBy: ownerId,
      filename: "dupe-phone.csv",
      headers: ["id", "full_name", "phone_number"],
      rows: [
        {
          id: "ml_legacy_dupe",
          full_name: "Should Match Sana",
          phone_number: "923007778899",
        },
      ],
    });
    const user = {
      id: ownerId,
      email: "owner@import.local",
      name: "Owner",
      role: "owner" as const,
    };
    updateMapping(job.id, user, {
      mapping: {
        id: "meta_lead_id",
        full_name: "name",
        phone_number: "phone",
      },
      nudge_hours: null,
      note_on_match: false,
    });
    const result = commitJob(job.id, user, true);
    expect(result.report.created).toBe(0);
    expect(result.report.skipped_dupes).toBe(1);
    expect(listJobRows(job.id)[0].outcome).toBe("duplicate_phone");
  });

  it("AD-02: nudge_hours rejects values outside {0,2,4,24,null}", async () => {
    const { createImportJob, updateMapping, ImportError } = await import(
      "@/lib/imports"
    );
    const job = createImportJob({
      uploadedBy: ownerId,
      filename: "nudge.csv",
      headers: ["id", "full_name", "phone_number"],
      rows: [{ id: "n1", full_name: "N", phone_number: "923008887776" }],
    });
    const user = {
      id: ownerId,
      email: "owner@import.local",
      name: "Owner",
      role: "owner" as const,
    };
    try {
      updateMapping(job.id, user, {
        mapping: {
          id: "meta_lead_id",
          full_name: "name",
          phone_number: "phone",
        },
        nudge_hours: 99,
      });
      expect.fail("expected ImportError");
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as InstanceType<typeof ImportError>).status).toBe(400);
    }
  });

  it("AD-03: first_name+last_name both map to name", async () => {
    const { defaultMapping } = await import("@/lib/import-map");
    const m = defaultMapping(["first_name", "last_name", "phone_number"]);
    expect(m.first_name).toBe("name");
    expect(m.last_name).toBe("name");
    expect(m.phone_number).toBe("phone");
  });

  it("AD-04: formula-like names neutralized on import write", async () => {
    const { createImportJob, updateMapping, commitJob } = await import(
      "@/lib/imports"
    );
    const { getLead } = await import("@/lib/leads");
    const { listJobRows } = await import("@/lib/imports");

    const job = createImportJob({
      uploadedBy: ownerId,
      filename: "formula.csv",
      headers: ["id", "full_name", "phone_number"],
      rows: [
        {
          id: "ml_formula_1",
          full_name: "=CMD|'/c calc'!A1",
          phone_number: "923007771234",
        },
      ],
    });
    const user = {
      id: ownerId,
      email: "owner@import.local",
      name: "Owner",
      role: "owner" as const,
    };
    updateMapping(job.id, user, {
      mapping: {
        id: "meta_lead_id",
        full_name: "name",
        phone_number: "phone",
      },
      nudge_hours: null,
    });
    const result = commitJob(job.id, user, true);
    expect(result.report.created).toBe(1);
    const row = listJobRows(job.id)[0];
    const lead = getLead(row.lead_id!)!;
    expect(lead.name.startsWith("'")).toBe(true);
    expect(lead.name).toContain("=CMD");
  });


  it("M1: agent note_on_match on foreign phone → duplicate_phone, no note", async () => {
    const {
      createImportJob,
      updateMapping,
      commitJob,
      listJobRows,
      previewJob,
    } = await import("@/lib/imports");
    const { listNotes, findLeadByPhone } = await import("@/lib/leads");

    const foreign = findLeadByPhone("923001111111");
    expect(foreign).toBeTruthy();
    expect(foreign!.owner_id).toBe(ownerId);
    const notesBefore = listNotes(foreign!.id).length;

    const job = createImportJob({
      uploadedBy: agentId,
      filename: "agent-foreign-note.csv",
      headers: ["id", "full_name", "phone_number", "campaign_name"],
      rows: [
        {
          id: "ml_agent_foreign_note",
          full_name: "Should Not Note",
          phone_number: "923001111111",
          campaign_name: "Agent Try",
        },
      ],
    });
    const agent = {
      id: agentId,
      email: "agent@import.local",
      name: "Agent",
      role: "agent" as const,
    };
    const mapped = updateMapping(job.id, agent, {
      mapping: {
        id: "meta_lead_id",
        full_name: "name",
        phone_number: "phone",
        campaign_name: "meta_campaign",
      },
      note_on_match: true,
      nudge_hours: null,
    });
    expect(mapped.preview.would_note_on_match).toBe(0);
    expect(mapped.preview.would_dupe_phone).toBe(1);

    const preview = previewJob(job.id, agent);
    expect(preview.preview.would_note_on_match).toBe(0);
    expect(preview.preview.would_dupe_phone).toBe(1);

    const result = commitJob(job.id, agent, true);
    expect(result.report.created).toBe(0);
    expect(result.report.note_on_match).toBe(0);
    expect(result.report.skipped_dupes).toBe(1);
    const row = listJobRows(job.id)[0];
    expect(row.outcome).toBe("duplicate_phone");
    expect(listNotes(foreign!.id).length).toBe(notesBefore);
  });

  it("M2: agent job/report omits foreign lead_id; owner keeps it", async () => {
    const {
      createImportJob,
      updateMapping,
      commitJob,
      listJobRows,
      serializeJobRow,
    } = await import("@/lib/imports");
    const { findLeadByPhone } = await import("@/lib/leads");

    const foreign = findLeadByPhone("923001111111")!;
    const job = createImportJob({
      uploadedBy: agentId,
      filename: "agent-dupe-phone.csv",
      headers: ["id", "full_name", "phone_number"],
      rows: [
        {
          id: "ml_agent_dupe_phone",
          full_name: "Dupe Phone Row",
          phone_number: "923001111111",
        },
      ],
    });
    const agent = {
      id: agentId,
      email: "agent@import.local",
      name: "Agent",
      role: "agent" as const,
    };
    const owner = {
      id: ownerId,
      email: "owner@import.local",
      name: "Owner",
      role: "owner" as const,
    };
    updateMapping(job.id, agent, {
      mapping: {
        id: "meta_lead_id",
        full_name: "name",
        phone_number: "phone",
      },
      note_on_match: false,
      nudge_hours: null,
    });
    commitJob(job.id, agent, true);
    const raw = listJobRows(job.id)[0];
    expect(raw.outcome).toBe("duplicate_phone");
    expect(raw.lead_id).toBe(foreign.id);

    const agentView = serializeJobRow(agent, raw);
    expect(agentView.lead_id).toBeNull();

    const ownerView = serializeJobRow(owner, raw);
    expect(ownerView.lead_id).toBe(foreign.id);

    sessionCookie = agentSession;
    const { GET: getJobRoute } = await import(
      "@/app/api/imports/[jobId]/route"
    );
    const res = await getJobRoute(
      new Request(
        `http://localhost/api/imports/${job.id}?include_rows=1`
      ) as never,
      { params: Promise.resolve({ jobId: job.id }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows[0].lead_id).toBeNull();

    const { GET: reportCsv } = await import(
      "@/app/api/imports/[jobId]/report.csv/route"
    );
    const csvRes = await reportCsv(
      new Request(
        `http://localhost/api/imports/${job.id}/report.csv`
      ) as never,
      { params: Promise.resolve({ jobId: job.id }) }
    );
    expect(csvRes.status).toBe(200);
    const csv = await csvRes.text();
    expect(csv).not.toContain(foreign.id);
  });

});
