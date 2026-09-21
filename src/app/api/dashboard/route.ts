import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { followUpQueue, getDashboardStats } from "@/lib/leads";

export async function GET() {
  try {
    const user = await requireUser();
    const ownerId = user.role === "owner" ? undefined : user.id;
    const stats = getDashboardStats({ ownerId });
    const queue = followUpQueue({ ownerId });
    return NextResponse.json({ stats, follow_ups: queue });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Dashboard failed" }, { status: 500 });
  }
}
