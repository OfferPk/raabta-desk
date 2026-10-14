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

const STAGE_COLORS: Record<Stage, string> = {
  new: "bg-sky-500",
  qualified: "bg-indigo-500",
  follow_up: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-slate-400",
};

export default async function DashboardPage() {
  const user = (await getSessionUser())!;
  const ownerId = user.role === "owner" ? undefined : user.id;
  const stats = getDashboardStats({ ownerId });
  const queue = followUpQueue({ ownerId }).slice(0, 8);
  const showOnboarding =
    stats.total_leads === 0 && !isOnboardingDismissed(user.id);

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-2xl border border-teal-700 bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-700 px-5 py-6 text-white shadow-sm sm:px-7 sm:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -right-1 -top-14 h-44 w-44 rounded-full border border-white/10" />
          <div className="absolute -bottom-28 right-24 h-52 w-52 rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-50">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-teal-200" />
              Sales desk · Overview
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Assalam-o-alaikum, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-teal-50/90 sm:text-base">
              Keep every conversation moving. Here&apos;s what needs your team&apos;s attention.
            </p>
          </div>
          <Link
            href="/leads/new"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-700"
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span>
            New lead
          </Link>
        </div>
      </section>

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

      <section className="space-y-3" aria-labelledby="snapshot-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="snapshot-heading" className="text-sm font-semibold text-slate-800">
              At a glance
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">A quick snapshot of your pipeline</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
            {stats.total_leads} {stats.total_leads === 1 ? "lead" : "leads"} total
          </span>
        </div>
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
      </section>

      {stats.archived_count > 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {stats.archived_count} archived lead
          {stats.archived_count === 1 ? "" : "s"} hidden —{" "}
          <Link href="/board?archived=1" className="font-medium text-teal-700 hover:underline">
            show on board
          </Link>
        </p>
      )}

      <section className="card space-y-4" aria-labelledby="stage-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="stage-heading" className="text-sm font-semibold text-slate-800">
              Leads by stage
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">See how work is distributed across your pipeline</p>
          </div>
          <Link href="/board" className="text-xs font-medium text-teal-700 hover:underline">
            Open board
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((stage: Stage) => {
            const count = stats.counts[stage];
            const share = stats.total_leads
              ? Math.round((count / stats.total_leads) * 100)
              : 0;
            return (
              <div
                key={stage}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 transition hover:border-teal-200 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-slate-600">
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {count}
                  </span>
                </div>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-label={`${STAGE_LABELS[stage]} share of leads`}
                  aria-valuenow={share}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full transition-[width] ${STAGE_COLORS[stage]}`}
                    style={{ width: `${share}%` }}
                  />
                </div>
                <div className="mt-1.5 text-right text-[10px] text-slate-500">
                  {share}% of leads
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" aria-labelledby="follow-ups-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="follow-ups-heading" className="text-sm font-semibold text-slate-800">
              Follow-ups due / overdue
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Your next conversations to move forward</p>
          </div>
          <Link href="/follow-ups" className="text-xs font-medium text-teal-700 hover:underline">
            View all
          </Link>
        </div>
        {queue.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
            Nothing due. Nice work!
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queue.map((lead) => (
              <li
                key={lead.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-1"
              >
                <div className="min-w-0">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-slate-800 hover:text-teal-700"
                  >
                    {lead.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <StageBadge stage={lead.stage} />
                    <span>{formatDateTime(lead.next_follow_up)}</span>
                    <span>{formatMoney(lead.value_cents, lead.currency)}</span>
                  </div>
                </div>
                <WhatsAppButton phone={lead.phone} className="text-xs py-1.5" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "danger" | "warn" | "ok";
}) {
  const palette = {
    neutral: {
      card: "border-slate-200 bg-gradient-to-br from-white to-slate-50",
      dot: "bg-teal-500",
    },
    danger: {
      card: "border-rose-200 bg-gradient-to-br from-white to-rose-50",
      dot: "bg-rose-500",
    },
    warn: {
      card: "border-amber-200 bg-gradient-to-br from-white to-amber-50",
      dot: "bg-amber-500",
    },
    ok: {
      card: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50",
      dot: "bg-emerald-500",
    },
  }[tone];

  return (
    <div className={`rounded-xl border p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${palette.card}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${palette.dot}`} />
        {label}
      </div>
      <div className="mt-2.5 break-words text-xl font-semibold tracking-tight tabular-nums text-slate-900 sm:text-2xl">
        {value}
      </div>
    </div>
  );
}
