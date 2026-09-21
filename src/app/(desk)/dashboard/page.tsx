import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { followUpQueue, getDashboardStats } from "@/lib/leads";
import { formatMoney, formatDateTime } from "@/lib/format";
import { isOnboardingDismissed } from "@/lib/settings";
import { STAGE_LABELS, STAGES, type Stage } from "@/lib/types";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { StageBadge } from "@/components/StageBadge";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ImportCadenceBanner } from "@/components/ImportCadenceBanner";
import { PipelineHealthStrip } from "@/components/PipelineHealthStrip";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = (await getSessionUser())!;
  const ownerId = user.role === "owner" ? undefined : user.id;
  const stats = getDashboardStats({ ownerId });
  const queue = followUpQueue({ ownerId }).slice(0, 8);
  const showOnboarding =
    stats.total_leads === 0 && !isOnboardingDismissed(user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Assalam-o-alaikum, {user.name.split(" ")[0]} — here&apos;s your desk
          </p>
        </div>
        <Link href="/leads/new" className="btn-primary">
          + New lead
        </Link>
      </div>

      <OnboardingChecklist
        show={showOnboarding || stats.total_leads === 0}
        initiallyDismissed={isOnboardingDismissed(user.id)}
      />

      <ImportCadenceBanner
        show={stats.import_cadence_due}
        remindDays={stats.import_remind_days}
        lastImportAt={stats.last_import_at}
        isOwner={user.role === "owner"}
      />

      <PipelineHealthStrip
        overdue={stats.overdue}
        overdueValueCents={stats.overdue_value_cents}
        currency={stats.currency}
        staleLeads={stats.stale_leads}
        importsThisWeek={stats.imports_this_week}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total leads" value={String(stats.total_leads)} />
        <StatCard
          label="Overdue"
          value={String(stats.overdue)}
          tone={stats.overdue > 0 ? "danger" : "ok"}
        />
        <StatCard label="Due today" value={String(stats.due_today)} tone="warn" />
        <StatCard
          label="Open pipeline"
          value={formatMoney(stats.open_pipeline_cents, stats.currency)}
        />
      </div>

      {stats.archived_count > 0 && (
        <p className="text-xs text-slate-500">
          {stats.archived_count} archived lead
          {stats.archived_count === 1 ? "" : "s"} hidden —{" "}
          <Link href="/board?archived=1" className="text-teal-700 hover:underline">
            show on board
          </Link>
        </p>
      )}

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">By stage</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STAGES.map((s: Stage) => (
            <div
              key={s}
              className="rounded-lg bg-slate-50 px-3 py-2 text-center"
            >
              <div className="text-lg font-semibold">{stats.counts[s]}</div>
              <div className="text-xs text-slate-500">{STAGE_LABELS[s]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Follow-ups due / overdue
          </h2>
          <Link href="/follow-ups" className="text-xs text-teal-700 hover:underline">
            View all
          </Link>
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing due. Nice work!</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queue.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/leads/${l.id}`}
                    className="font-medium text-slate-800 hover:text-teal-700"
                  >
                    {l.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <StageBadge stage={l.stage} />
                    <span>{formatDateTime(l.next_follow_up)}</span>
                    <span>{formatMoney(l.value_cents, l.currency)}</span>
                  </div>
                </div>
                <WhatsAppButton phone={l.phone} className="text-xs py-1.5" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "warn" | "ok";
}) {
  const ring =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${ring}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
