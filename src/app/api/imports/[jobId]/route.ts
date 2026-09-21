import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import {
  canAccessJob,
  getJob,
  ImportError,
  jobSummary,
  listJobRows,
  serializeJobRow,
} from "@/lib/imports";
import { logRequest, newRequestId } from "@/lib/logger";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const { jobId } = await ctx.params;
    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (!canAccessJob(user, job)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Use req.url so plain Request (vitest) works without NextRequest.nextUrl
    const include =
      new URL(req.url).searchParams.get("include_rows") === "1" ||
      job.status === "done" ||
      job.status === "failed";

    const payload: { job: ReturnType<typeof jobSummary>; rows?: unknown[] } = {
      job: jobSummary(job),
    };
    if (include) {
      payload.rows = listJobRows(jobId).map((r) => serializeJobRow(user, r));
    }
    logRequest({
      requestId,
      route: "GET /api/imports/:jobId",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof ImportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to get import" }, { status: 500 });
  }
}
