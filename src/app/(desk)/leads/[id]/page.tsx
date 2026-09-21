import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canAccessLead, getLead, listNotes } from "@/lib/leads";
import { getDb } from "@/lib/db";
import { LeadDetail } from "@/components/LeadDetail";

export const dynamic = "force-dynamic";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  const lead = getLead(id);
  if (!lead) notFound();
  if (!canAccessLead(user, lead)) redirect("/board");

  const notes = listNotes(lead.id);
  const users =
    user.role === "owner"
      ? (getDb()
          .prepare("SELECT id, name FROM users ORDER BY name")
          .all() as { id: string; name: string }[])
      : [];

  return (
    <LeadDetail
      lead={lead}
      notes={notes}
      users={users}
      canDelete={user.role === "owner" || lead.owner_id === user.id}
    />
  );
}
