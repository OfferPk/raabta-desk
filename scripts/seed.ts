/**
 * Seed demo workspace: owner + agent + sample leads/notes.
 * Usage: npm run seed
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH
  ? path.isAbsolute(process.env.DATABASE_PATH)
    ? process.env.DATABASE_PATH
    : path.join(process.cwd(), process.env.DATABASE_PATH)
  : path.join(process.cwd(), "data", "raabta.db");

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Fresh seed: remove existing DB
for (const suffix of ["", "-wal", "-shm"]) {
  const p = dbPath + suffix;
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'agent')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    source TEXT,
    stage TEXT NOT NULL CHECK(stage IN ('new', 'qualified', 'follow_up', 'won', 'lost')),
    owner_id TEXT NOT NULL REFERENCES users(id),
    value_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'PKR',
    next_follow_up TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
`);

const hash = (p: string) => bcrypt.hashSync(p, 10);
const now = new Date();
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d;
};
const daysFrom = (n: number, hour = 10) => {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const ownerId = crypto.randomUUID();
const agentId = crypto.randomUUID();

db.prepare(
  `INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
).run(
  ownerId,
  "owner@raabta.local",
  hash("owner123"),
  "Ayesha Khan",
  "owner",
  iso(daysAgo(30))
);

db.prepare(
  `INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`
).run(
  agentId,
  "agent@raabta.local",
  hash("agent123"),
  "Bilal Ahmed",
  "agent",
  iso(daysAgo(20))
);

type LeadSeed = {
  name: string;
  phone: string;
  email?: string;
  source: string;
  stage: string;
  owner_id: string;
  value: number;
  follow?: Date | null;
  note?: string;
};

const seeds: LeadSeed[] = [
  {
    name: "Fatima Raza",
    phone: "923001112233",
    email: "fatima@example.com",
    source: "WhatsApp",
    stage: "new",
    owner_id: agentId,
    value: 85000,
    follow: daysFrom(0, 15),
    note: "Asked about premium package pricing.",
  },
  {
    name: "Omar Siddiqui",
    phone: "923334445566",
    source: "Referral",
    stage: "qualified",
    owner_id: ownerId,
    value: 250000,
    follow: daysFrom(-1, 11),
    note: "Budget confirmed. Send brochure.",
  },
  {
    name: "Sana Malik",
    phone: "+92 300 7778899",
    email: "sana@example.com",
    source: "Instagram",
    stage: "follow_up",
    owner_id: agentId,
    value: 120000,
    follow: daysFrom(0, 9),
    note: "Follow up on demo feedback.",
  },
  {
    name: "Hassan Ali",
    phone: "923212223344",
    source: "Website",
    stage: "won",
    owner_id: ownerId,
    value: 500000,
    follow: null,
    note: "Closed — invoice sent.",
  },
  {
    name: "Noor Fatima",
    phone: "923455556667",
    source: "Walk-in",
    stage: "lost",
    owner_id: agentId,
    value: 40000,
    follow: null,
    note: "Chose a competitor on price.",
  },
  {
    name: "Zainab Iqbal",
    phone: "924201112233",
    source: "WhatsApp",
    stage: "new",
    owner_id: ownerId,
    value: 95000,
    follow: daysFrom(2, 14),
  },
];

const insertLead = db.prepare(
  `INSERT INTO leads
    (id, name, phone, email, source, stage, owner_id, value_cents, currency, next_follow_up, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PKR', ?, ?, ?)`
);
const insertNote = db.prepare(
  `INSERT INTO notes (id, lead_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`
);

for (const s of seeds) {
  const id = crypto.randomUUID();
  const created = iso(daysAgo(Math.floor(Math.random() * 10) + 1));
  insertLead.run(
    id,
    s.name,
    s.phone,
    s.email || null,
    s.source,
    s.stage,
    s.owner_id,
    Math.round(s.value * 100),
    s.follow ? iso(s.follow) : null,
    created,
    created
  );
  if (s.note) {
    insertNote.run(
      crypto.randomUUID(),
      id,
      s.owner_id,
      s.note,
      created
    );
  }
}

db.close();

console.log("Seeded Raabta Desk demo data at", dbPath);
console.log("");
console.log("Demo logins:");
console.log("  Owner: owner@raabta.local / owner123");
console.log("  Agent: agent@raabta.local / agent123");
console.log("");
console.log("Run: npm run dev");
