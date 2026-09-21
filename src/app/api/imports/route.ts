import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { ParseError, parseImportFile } from "@/lib/import-parse";
import {
  createImportJob,
  ImportError,
  jobSummary,
  listJobs,
} from "@/lib/imports";
import { logRequest, newRequestId } from "@/lib/logger";

export async function GET() {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const jobs = listJobs({
      uploadedBy: user.role === "owner" ? undefined : user.id,
      limit: 50,
    }).map(jobSummary);
    logRequest({
      requestId,
      route: "GET /api/imports",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });
    return NextResponse.json({ jobs });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to list imports" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const filename = file.name || "upload.csv";
    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    let parsed;
    try {
      parsed = parseImportFile(filename, buf);
    } catch (e) {
      if (e instanceof ParseError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const job = createImportJob({
      uploadedBy: user.id,
      filename,
      headers: parsed.headers,
      rows: parsed.rows,
    });

    logRequest({
      requestId,
      route: "POST /api/imports",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 201,
    });
    return NextResponse.json({ job: jobSummary(job) }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof ImportError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    logRequest({
      requestId,
      route: "POST /api/imports",
      durationMs: Date.now() - start,
      status: 500,
      error: String(e),
    });
    return NextResponse.json({ error: "Failed to upload import" }, { status: 500 });
  }
}
