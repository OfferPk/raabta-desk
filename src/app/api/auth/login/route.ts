import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  createSession,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { logRequest, newRequestId } from "@/lib/logger";
import {
  checkRateLimit,
  clearRateLimit,
  recordRateLimitFailure,
} from "@/lib/rate-limit";

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

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

    const ip = clientIp(req);
    const ipKey = `login:ip:${ip}`;
    const emailKey = `login:email:${email}`;
    for (const key of [ipKey, emailKey]) {
      const lim = checkRateLimit(key);
      if (!lim.ok) {
        return NextResponse.json(
          {
            error: `Too many failed login attempts. Try again in ${lim.retryAfterSec}s.`,
          },
          {
            status: 429,
            headers: { "Retry-After": String(lim.retryAfterSec) },
          }
        );
      }
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
      recordRateLimitFailure(ipKey);
      recordRateLimitFailure(emailKey);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    clearRateLimit(ipKey);
    clearRateLimit(emailKey);

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
