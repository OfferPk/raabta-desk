import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  createSession,
  setSessionCookie,
  verifyPassword,
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

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const user = db
      .prepare(
        "SELECT id, email, name, role, password_hash FROM users WHERE email = ?"
      )
      .get(email) as
      | {
          id: string;
          email: string;
          name: string;
          role: string;
          password_hash: string;
        }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const sessionId = createSession(user.id);
    await setSessionCookie(sessionId, req.headers);

    logRequest({
      requestId,
      route: "POST /api/auth/login",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (e) {
    logRequest({
      requestId,
      route: "POST /api/auth/login",
      durationMs: Date.now() - start,
      status: 500,
      error: String(e),
    });
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
