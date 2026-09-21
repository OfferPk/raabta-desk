import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listLeads } from "@/lib/leads";
import { isOnboardingDismissed } from "@/lib/settings";
import { KanbanBoard } from "@/components/KanbanBoard";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { BoardArchiveToggle } from "@/components/BoardArchiveToggle";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = (await getSessionUser())!;
  const sp = await searchParams;
  const showArchived = sp.archived === "1";
  const ownerId = user.role === "owner" ? undefined : user.id;
  const leads = listLeads({
    ownerId,
    includeArchived: showArchived,
  });
  const activeCount = listLeads({ ownerId }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pipeline board</h1>
          <p className="text-sm text-slate-500">
            Move leads with the stage buttons
            {showArchived ? " · showing archived too" : " · archived hidden"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BoardArchiveToggle showArchived={showArchived} />
          <Link href="/leads/new" className="btn-primary">
            + New lead
          </Link>
        </div>
      </div>
      <OnboardingChecklist
        show={activeCount === 0}
        initiallyDismissed={isOnboardingDismissed(user.id)}
      />
      <KanbanBoard leads={leads} />
    </div>
  );
}
