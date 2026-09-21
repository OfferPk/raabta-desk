import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { Role, SessionUser } from "./types";

const SESSION_COOKIE = "raabta_session";
const SESSION_DAYS = 14;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function createSession(userId: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  db.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(id, userId, expires.toISOString());
  return id;
}

export function destroySession(sessionId: string) {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionId) as
    | { id: string; email: string; name: string; role: Role; expires_at: string }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

type HeaderLike = { get(name: string): string | null };

/**
 * Secure cookie flag:
 * - COOKIE_SECURE=false|0 → never Secure (local HTTP `next start`)
 * - COOKIE_SECURE=true|1 → always Secure
 * - else if x-forwarded-proto is https → Secure
 * - else default Secure when NODE_ENV=production
 */
export function shouldUseSecureCookie(headers?: HeaderLike | null): boolean {
  const env = process.env.COOKIE_SECURE;
  if (env === "false" || env === "0") return false;
  if (env === "true" || env === "1") return true;
  if (headers) {
    const proto = headers.get("x-forwarded-proto");
    if (proto) {
      return proto.split(",")[0].trim().toLowerCase() === "https";
    }
  }
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(
  sessionId: string,
  headers?: HeaderLike | null
) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(headers),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(headers?: HeaderLike | null) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(headers),
    path: "/",
    maxAge: 0,
  });
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("Unauthorized", 401);
  }
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "owner") {
    throw new AuthError("Forbidden — owners only", 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function countUsers(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as c FROM users").get() as {
    c: number;
  };
  return row.c;
}
