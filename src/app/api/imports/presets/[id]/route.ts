import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { deletePreset } from "@/lib/imports";
import { logRequest, newRequestId } from "@/lib/logger";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const ok = deletePreset(id);
    if (!ok) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }
    logRequest({
      requestId,
      route: "DELETE /api/imports/presets/:id",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to delete preset" }, { status: 500 });
  }
}
