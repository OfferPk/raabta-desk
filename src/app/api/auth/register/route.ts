import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  countUsers,
  createSession,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";
import { logRequest, newRequestId } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const isFirst = countUsers() === 0;
    const role = isFirst ? "owner" : "agent";
    // Public register only creates the first owner. Agents are created by owner.
    if (!isFirst) {
      return NextResponse.json(
        {
          error:
            "Workspace already has an owner. Ask the owner to create your agent account.",
        },
        { status: 403 }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, email, hashPassword(password), name, role, now);

    const sessionId = createSession(id);
    await setSessionCookie(sessionId, req.headers);

    logRequest({
      requestId,
      route: "POST /api/auth/register",
      userId: id,
      durationMs: Date.now() - start,
      status: 201,
    });

    return NextResponse.json(
      { user: { id, email, name, role } },
      { status: 201 }
    );
  } catch (e) {
    logRequest({
      requestId,
      route: "POST /api/auth/register",
      durationMs: Date.now() - start,
      status: 500,
      error: String(e),
    });
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
