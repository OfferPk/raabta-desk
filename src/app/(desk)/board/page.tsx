import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listLeads } from "@/lib/leads";
import { KanbanBoard } from "@/components/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const user = (await getSessionUser())!;
  const leads = listLeads({
    ownerId: user.role === "owner" ? undefined : user.id,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pipeline board</h1>
          <p className="text-sm text-slate-500">
            Move leads with the stage buttons
          </p>
        </div>
        <Link href="/leads/new" className="btn-primary">
          + New lead
        </Link>
      </div>
      <KanbanBoard leads={leads} />
    </div>
  );
}
