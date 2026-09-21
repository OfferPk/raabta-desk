import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  clearSessionCookie,
  destroySession,
  getSessionCookieName,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(getSessionCookieName())?.value;
  if (sessionId) {
    destroySession(sessionId);
  }
  await clearSessionCookie(req.headers);
  return NextResponse.json({ ok: true });
}
