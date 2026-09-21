import { getSessionUser } from "@/lib/auth";
import { followUpQueue } from "@/lib/leads";
import { FollowUpList } from "@/components/FollowUpList";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const user = (await getSessionUser())!;
  const leads = followUpQueue({
    ownerId: user.role === "owner" ? undefined : user.id,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Follow-up queue</h1>
        <p className="text-sm text-slate-500">
          Due today and overdue — mark done or snooze to tomorrow
        </p>
      </div>
      <FollowUpList leads={leads} />
    </div>
  );
}
