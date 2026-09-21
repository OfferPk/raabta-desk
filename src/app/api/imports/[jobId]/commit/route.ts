import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { commitJob, ImportError, jobSummary } from "@/lib/imports";
import { logRequest, newRequestId } from "@/lib/logger";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const { jobId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const result = commitJob(jobId, user, !!body.confirm);
    logRequest({
      requestId,
      route: "POST /api/imports/:jobId/commit",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });
    return NextResponse.json({
      job: jobSummary(result.job),
      report: result.report,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof ImportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    logRequest({
      requestId,
      route: "POST /api/imports/:jobId/commit",
      durationMs: Date.now() - start,
      status: 500,
      error: String(e),
    });
    return NextResponse.json({ error: "Failed to commit import" }, { status: 500 });
  }
}
