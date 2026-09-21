import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { csvEscape } from "@/lib/csv";
import {
  canAccessJob,
  getJob,
  listJobRows,
  serializeJobRow,
} from "@/lib/imports";
import { logRequest, newRequestId } from "@/lib/logger";

export async function GET(
  _req: NextRequest,
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

    const rows = listJobRows(jobId).map((r) => serializeJobRow(user, r));
    const header = [
      "row_number",
      "meta_lead_id",
      "phone",
      "outcome",
      "lead_id",
      "message",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.row_number),
          csvEscape(r.meta_lead_id),
          csvEscape(r.phone_norm || r.phone_raw),
          csvEscape(r.outcome),
          csvEscape(r.lead_id),
          csvEscape(r.message),
        ].join(",")
      );
    }

    logRequest({
      requestId,
      route: "GET /api/imports/:jobId/report.csv",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });

    return new NextResponse(lines.join("\n") + "\n", {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="import-${jobId}-report.csv"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to export report" }, { status: 500 });
  }
}
