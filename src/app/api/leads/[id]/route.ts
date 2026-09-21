import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  canAccessLead,
  deleteLead,
  getLead,
  listNotes,
  setLeadArchived,
  updateLead,
} from "@/lib/leads";
import { PHONE_REQUIRED_HINT, preparePhoneForStorage } from "@/lib/phone";
import { STAGES, type Stage } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const lead = getLead(id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!canAccessLead(user, lead)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const notes = listNotes(lead.id);
    return NextResponse.json({ lead, notes });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to get lead" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const lead = getLead(id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!canAccessLead(user, lead)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const patch: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json(
          { error: "Name and phone are required" },
          { status: 400 }
        );
      }
      patch.name = name;
    }
    if (body.phone !== undefined) {
      const phoneRaw = String(body.phone).trim();
      if (!phoneRaw) {
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
      patch.phone = phone;
    }
    if (body.email !== undefined)
      patch.email = body.email ? String(body.email).trim() : null;
    if (body.source !== undefined)
      patch.source = body.source ? String(body.source).trim() : null;
    if (body.stage !== undefined) {
      if (!STAGES.includes(body.stage)) {
        return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      }
      patch.stage = body.stage as Stage;
    }
    if (body.owner_id !== undefined && user.role === "owner") {
      const ownerId = String(body.owner_id);
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
      patch.owner_id = ownerId;
    }
    if (body.value !== undefined || body.value_rupees !== undefined) {
      const v = Number(body.value ?? body.value_rupees ?? 0);
      patch.value_cents = Math.max(
        0,
        Math.round(Number.isFinite(v) ? v * 100 : 0)
      );
    }
    if (body.value_cents !== undefined) {
      patch.value_cents = Math.max(
        0,
        Math.round(Number(body.value_cents) || 0)
      );
    }
    if (body.currency !== undefined) patch.currency = String(body.currency);
    if (body.next_follow_up !== undefined) {
      patch.next_follow_up = body.next_follow_up
        ? String(body.next_follow_up)
        : null;
    }

    // Soft-archive (preferred over hard delete for won/lost clutter)
    if (body.archived !== undefined) {
      const archived =
        body.archived === true ||
        body.archived === 1 ||
        body.archived === "1" ||
        body.archived === "true";
      const updated = setLeadArchived(id, archived);
      return NextResponse.json({ lead: updated });
    }

    const updated = updateLead(id, patch as Parameters<typeof updateLead>[1]);
    return NextResponse.json({ lead: updated });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const lead = getLead(id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!canAccessLead(user, lead)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    deleteLead(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
