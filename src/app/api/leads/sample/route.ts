import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { createSampleLead } from "@/lib/leads";

export async function POST() {
  try {
    const user = await requireUser();
    const lead = createSampleLead(user.id);
    return NextResponse.json({ lead }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: "Could not create sample lead" },
      { status: 500 }
    );
  }
}
