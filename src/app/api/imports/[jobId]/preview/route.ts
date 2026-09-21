import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { ImportError, jobSummary, previewJob } from "@/lib/imports";
import { logRequest, newRequestId } from "@/lib/logger";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const { jobId } = await ctx.params;
    const result = previewJob(jobId, user);
    logRequest({
      requestId,
      route: "POST /api/imports/:jobId/preview",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });
    return NextResponse.json({
      job: jobSummary(result.job),
      preview: result.preview,
      sample_outcomes: result.sample_outcomes,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof ImportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to preview" }, { status: 500 });
  }
}
