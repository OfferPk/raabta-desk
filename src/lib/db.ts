import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DEFAULT_PATH = path.join(process.cwd(), "data", "raabta.db");

let dbInstance: Database.Database | null = null;

function resolveDbPath(): string {
  const fromEnv = process.env.DATABASE_PATH;
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  return DEFAULT_PATH;
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  dbInstance = db;
  return db;
}

function migrate(db: Database.Database) {
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

    CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
    CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
    CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(next_follow_up);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_lead ON notes(lead_id);
  `);
}

/** Reset singleton — used in tests / seed. */
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
