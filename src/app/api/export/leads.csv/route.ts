import { NextResponse } from "next/server";
import { AuthError, requireOwner } from "@/lib/auth";
import { csvEscape } from "@/lib/csv";
import { listLeads } from "@/lib/leads";

export async function GET() {
  try {
    await requireOwner();
    const leads = listLeads({ includeArchived: true });
    const header = [
      "id",
      "name",
      "phone",
      "email",
      "source",
      "stage",
      "owner_name",
      "value_cents",
      "currency",
      "next_follow_up",
      "archived_at",
      "created_at",
      "updated_at",
    ];
    const lines = [header.join(",")];
    for (const l of leads) {
      lines.push(
        [
          l.id,
          l.name,
          l.phone,
          l.email,
          l.source,
          l.stage,
          l.owner_name,
          l.value_cents,
          l.currency,
          l.next_follow_up,
          l.archived_at ?? "",
          l.created_at,
          l.updated_at,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    const body = lines.join("\n") + "\n";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="raabta-leads.csv"',
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
