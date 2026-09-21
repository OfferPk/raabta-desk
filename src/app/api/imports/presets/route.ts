import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { isValidMapTarget } from "@/lib/import-map";
import { createPreset, ImportError, listPresets } from "@/lib/imports";
import type { MapTarget } from "@/lib/types";
import { logRequest, newRequestId } from "@/lib/logger";

export async function GET() {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const presets = listPresets().map((p) => ({
      id: p.id,
      name: p.name,
      header_fingerprint: p.header_fingerprint,
      mapping: JSON.parse(p.mapping_json),
      created_by: p.created_by,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
    logRequest({
      requestId,
      route: "GET /api/imports/presets",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });
    return NextResponse.json({ presets });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to list presets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
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
    const preset = createPreset({
      name: String(body.name || ""),
      mapping,
      headers: Array.isArray(body.headers)
        ? body.headers.map(String)
        : undefined,
      createdBy: user.id,
    });
    logRequest({
      requestId,
      route: "POST /api/imports/presets",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 201,
    });
    return NextResponse.json(
      {
        preset: {
          id: preset.id,
          name: preset.name,
          header_fingerprint: preset.header_fingerprint,
          mapping: JSON.parse(preset.mapping_json),
          created_by: preset.created_by,
          created_at: preset.created_at,
          updated_at: preset.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof ImportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to save preset" }, { status: 500 });
  }
}
