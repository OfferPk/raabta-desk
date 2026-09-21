import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { addNote, canAccessLead, getLead } from "@/lib/leads";

type Ctx = { params: Promise<{ id: string }> };

const NOTE_MAX_LEN = 5000;

export async function POST(req: NextRequest, { params }: Ctx) {
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
    const raw = String(body.body || "");
    if (raw.length > NOTE_MAX_LEN) {
      return NextResponse.json(
        { error: `Note body must be at most ${NOTE_MAX_LEN} characters` },
        { status: 400 }
      );
    }
    const text = raw.trim();
    if (!text) {
      return NextResponse.json({ error: "Note body required" }, { status: 400 });
    }
    const note = addNote(id, user.id, text);
    return NextResponse.json({ note }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}
