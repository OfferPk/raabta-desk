import { NextRequest, NextResponse } from "next/server";
import { AuthError, hashPassword, requireOwner, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();
    const db = getDb();
    // Agents can see teammate names for assignment display; only owners create.
    const rows = db
      .prepare(
        "SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC"
      )
      .all() as {
      id: string;
      email: string;
      name: string;
      role: string;
      created_at: string;
    }[];

    const users =
      user.role === "owner"
        ? rows
        : rows.map(({ id, name, role }) => ({
            id,
            name,
            role,
          }));

    return NextResponse.json({ users, me: user });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireOwner();
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    // Team create always forces agent — no multi-owner via this endpoint.
    const role = "agent";

    if (body.role === "owner") {
      return NextResponse.json(
        { error: "Only agent role can be created via Team" },
        { status: 400 }
      );
    }

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

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, email, hashPassword(password), name, role, now);

    return NextResponse.json(
      { user: { id, email, name, role, created_at: now } },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
