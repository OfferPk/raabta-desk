import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import {
  RATE_LIMIT_MAX,
  resetRateLimits,
} from "@/lib/rate-limit";

const tmpDb = path.join(process.cwd(), "data", "test-auth-hygiene.db");

function cleanupDbFiles() {
  for (const s of ["", "-wal", "-shm"]) {
    const p = tmpDb + s;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
  }),
}));

describe("Auth hygiene (rate limit + password floor)", () => {
  let login: typeof import("@/app/api/auth/login/route").POST;
  let register: typeof import("@/app/api/auth/register/route").POST;
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
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      "limit@test.local",
      bcrypt.hashSync("correcthorse", 10),
      "Limiter",
      "owner",
      now
    );
    login = (await import("@/app/api/auth/login/route")).POST;
    register = (await import("@/app/api/auth/register/route")).POST;
  });

  afterAll(() => {
    closeDb();
    cleanupDbFiles();
  });

  beforeEach(() => {
    resetRateLimits();
  });

  function req(url: string, body: unknown, ip = "10.0.0.9") {
    return new Request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }) as unknown as import("next/server").NextRequest;
  }

  it("rejects password shorter than 10 on register", async () => {
    // DB already has owner — register should 403 after password check... 
    // password check happens before isFirst check when fields present.
    // With existing owner, we still hit password floor first.
    const res = await register(
      req("http://localhost/api/auth/register", {
        name: "X",
        email: "short@test.local",
        password: "short",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least 10/i);
  });

  it("returns 429 after too many failed logins", async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const r = await login(
        req("http://localhost/api/auth/login", {
          email: "limit@test.local",
          password: "wrong-password",
        })
      );
      expect(r.status).toBe(401);
    }
    const blocked = await login(
      req("http://localhost/api/auth/login", {
        email: "limit@test.local",
        password: "wrong-password",
      })
    );
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toMatch(/Too many failed/i);
  });
});
