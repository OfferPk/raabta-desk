import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createLead, listLeads } from "@/lib/leads";
import { PHONE_REQUIRED_HINT, preparePhoneForStorage } from "@/lib/phone";
import { STAGES, type Stage } from "@/lib/types";
import { logRequest, newRequestId } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const stage = sp.get("stage") as Stage | null;
    const archived = sp.get("archived");
    const q = sp.get("q");
    const source = sp.get("source");
    const metaCampaign = sp.get("meta_campaign");
    const ownerParam = sp.get("owner_id");

    // Agents stay scoped to self; owners may filter by owner_id.
    let ownerId: string | undefined;
    if (user.role === "agent") {
      ownerId = user.id;
    } else if (ownerParam) {
      ownerId = ownerParam;
    }

    const leads = listLeads({
      ownerId,
      stage: stage && STAGES.includes(stage) ? stage : undefined,
      includeArchived: archived === "1" || archived === "all",
      archivedOnly: archived === "only",
      q: q || undefined,
      source: source || undefined,
      meta_campaign: metaCampaign || undefined,
    });
    logRequest({
      requestId,
      route: "GET /api/leads",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 200,
    });
    return NextResponse.json({ leads });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to list leads" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const start = Date.now();
  try {
    const user = await requireUser();
    const body = await req.json();
    const name = String(body.name || "").trim();
    const phoneRaw = String(body.phone || "").trim();
    if (!name || !phoneRaw) {
      return NextResponse.json(
        { error: "Name and phone are required" },
        { status: 400 }
      );
    }

    const phone = preparePhoneForStorage(phoneRaw);
    if (!phone) {
      return NextResponse.json(
        { error: PHONE_REQUIRED_HINT },
        { status: 400 }
      );
    }

    const stage = (body.stage as Stage) || "new";
    if (!STAGES.includes(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }

    let ownerId = user.id;
    if (body.owner_id && user.role === "owner") {
      ownerId = String(body.owner_id);
      const db = getDb();
      const owner = db
        .prepare("SELECT id FROM users WHERE id = ?")
        .get(ownerId);
      if (!owner) {
        return NextResponse.json(
          { error: "Invalid owner_id" },
          { status: 400 }
        );
      }
    }

    const valueRupees = Number(body.value ?? body.value_rupees ?? 0);
    const value_cents = Math.max(
      0,
      Math.round(Number.isFinite(valueRupees) ? valueRupees * 100 : 0)
    );

    const lead = createLead({
      name,
      phone,
      email: body.email ? String(body.email) : null,
      source: body.source ? String(body.source) : null,
      stage,
      owner_id: ownerId,
      value_cents,
      currency: body.currency ? String(body.currency) : "PKR",
      next_follow_up: body.next_follow_up
        ? String(body.next_follow_up)
        : null,
    });

    logRequest({
      requestId,
      route: "POST /api/leads",
      userId: user.id,
      durationMs: Date.now() - start,
      status: 201,
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    logRequest({
      requestId,
      route: "POST /api/leads",
      durationMs: Date.now() - start,
      status: 500,
      error: String(e),
    });
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
