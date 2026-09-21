import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { isValidMapTarget } from "@/lib/import-map";
import { ImportError, jobSummary, updateMapping } from "@/lib/imports";
import type { MapTarget } from "@/lib/types";
import { logRequest, newRequestId } from "@/lib/logger";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const { jobId } = await ctx.params;
    const body = await req.json();
    const rawMapping = body.mapping;
    if (!rawMapping || typeof rawMapping !== "object") {
      return NextResponse.json({ error: "mapping is required" }, { status: 400 });
    }
    const mapping: Record<string, MapTarget> = {};
    for (const [k, v] of Object.entries(rawMapping)) {
      if (!isValidMapTarget(v)) {
        return NextResponse.json(
          { error: `Invalid map target for ${k}` },
          { status: 400 }
        );
      }
      mapping[k] = v;
    }

    const result = updateMapping(jobId, user, {
      mapping,
      default_owner_id: body.default_owner_id,
      nudge_hours:
        body.nudge_hours === null || body.nudge_hours === undefined
          ? body.nudge_hours
          : Number(body.nudge_hours),
      note_on_match: body.note_on_match,
      save_preset_name: body.save_preset_name,
    });

    logRequest({
      requestId,
      route: "PATCH /api/imports/:jobId/mapping",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });
    return NextResponse.json({
      job: jobSummary(result.job),
      preview: result.preview,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof ImportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to save mapping" }, { status: 500 });
  }
}
