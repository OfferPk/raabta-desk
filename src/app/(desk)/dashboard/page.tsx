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

const STAGE_BAR_COLORS: Record<Stage, string> = {
  new: "bg-sky-500",
  qualified: "bg-violet-500",
  follow_up: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-slate-400",
};

export default async function DashboardPage() {
  const user = (await getSessionUser())!;
  const ownerId = user.role === "owner" ? undefined : user.id;
  const stats = getDashboardStats({ ownerId });
  const queue = followUpQueue({ ownerId }).slice(0, 8);
  const isOnboardingClosed = isOnboardingDismissed(user.id);
  const showOnboarding = stats.total_leads === 0 && !isOnboardingClosed;
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const stageTotal = STAGES.reduce((sum, stage) => sum + stats.counts[stage], 0);

  return (
    <div className="space-y-6 pb-8 sm:space-y-7">
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-teal-950 via-teal-800 to-emerald-700 px-5 py-6 text-white shadow-[0_18px_55px_rgba(15,118,110,0.18)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-12 -top-28 -z-10 h-72 w-72 rounded-full border-[32px] border-white/[0.06]" />
        <div aria-hidden="true" className="absolute -bottom-40 right-40 -z-10 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-50">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Your sales workspace
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Assalam-o-alaikum, {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-teal-50/85 sm:text-[15px]">
              Here&apos;s the latest from your desk. Keep every lead moving and every follow-up on time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/leads/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50 active:translate-y-px"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" d="M10 4v12M4 10h12" />
              </svg>
              Add a lead
            </Link>
            <Link
              href="/board"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View pipeline
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h12m-4-4 4 4-4 4" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <OnboardingChecklist
        show={showOnboarding || stats.total_leads === 0}
        initiallyDismissed={isOnboardingClosed}
      />

      <ImportCadenceBanner
        show={stats.import_cadence_due}
        remindDays={stats.import_remind_days}
        lastImportAt={stats.last_import_at}
        isOwner={user.role === "owner"}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total leads"
          value={String(stats.total_leads)}
          hint="Contacts in your desk"
          icon="leads"
          tone="teal"
        />
        <MetricCard
          label="Due today"
          value={String(stats.due_today)}
          hint="Conversations to continue"
          icon="today"
          tone="amber"
        />
        <MetricCard
          label="Open pipeline"
          value={formatMoney(stats.open_pipeline_cents, stats.currency)}
          hint="Value still in progress"
          icon="value"
          tone="violet"
        />
        <MetricCard
          label="Won leads"
          value={String(stats.counts.won)}
          hint="Deals marked successful"
          icon="won"
          tone="emerald"
        />
      </div>

      <PipelineHealthStrip
        overdue={stats.overdue}
        overdueValueCents={stats.overdue_value_cents}
        currency={stats.currency}
        staleLeads={stats.stale_leads}
        importsThisWeek={stats.imports_this_week}
      />

      {stats.archived_count > 0 && (
        <p className="-mt-3 text-xs text-slate-500">
          {stats.archived_count} archived lead{stats.archived_count === 1 ? "" : "s"} hidden. {" "}
          <Link href="/board?archived=1" className="font-semibold text-teal-700 hover:text-teal-900 hover:underline">
            View archived leads
          </Link>
        </p>
      )}

      <section className="card !p-5 sm:!p-6" aria-labelledby="pipeline-overview-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">At a glance</p>
            <h2 id="pipeline-overview-title" className="mt-1 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              Pipeline overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">See where every conversation stands.</p>
          </div>
          <Link href="/board" className="text-sm font-semibold text-teal-700 transition hover:text-teal-900">
            Open board <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {STAGES.map((stage: Stage) => {
            const count = stats.counts[stage];
            const percentage = stageTotal ? Math.round((count / stageTotal) * 100) : 0;
            return (
              <div key={stage} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium leading-5 text-slate-600">{STAGE_LABELS[stage]}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-slate-400">{percentage}%</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{count}</p>
                <div
                  role="progressbar"
                  aria-label={`${STAGE_LABELS[stage]} share of pipeline`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentage}
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"
                >
                  <div className={`h-full rounded-full transition-all ${STAGE_BAR_COLORS[stage]}`} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card !overflow-hidden !p-0" aria-labelledby="follow-up-title">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">Next best actions</p>
            <h2 id="follow-up-title" className="mt-1 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              Follow-ups to keep moving
            </h2>
            <p className="mt-1 text-sm text-slate-500">Due today and overdue conversations, in one place.</p>
          </div>
          <Link href="/follow-ups" className="rounded-xl px-3 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 hover:text-teal-900">
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>
        {queue.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center sm:py-12">
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-semibold text-emerald-700 ring-1 ring-emerald-100">✓</span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">You&apos;re all caught up</h3>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">There are no follow-ups due right now. Add a reminder to keep your next conversation on track.</p>
            <Link href="/leads" className="mt-4 text-sm font-semibold text-teal-700 hover:text-teal-900">Browse leads <span aria-hidden="true">→</span></Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queue.map((lead) => (
              <li key={lead.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <Link href={`/leads/${lead.id}`} className="truncate font-semibold text-slate-900 transition hover:text-teal-800">
                    {lead.name}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <StageBadge stage={lead.stage} />
                    <span className="inline-flex items-center gap-1.5">
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <circle cx="10" cy="10" r="6.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v4l2.5 1.5" />
                      </svg>
                      {formatDateTime(lead.next_follow_up)}
                    </span>
                    <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                    <span>{formatMoney(lead.value_cents, lead.currency)}</span>
                  </div>
                </div>
                <WhatsAppButton phone={lead.phone} className="!rounded-lg !px-3 !py-2 text-xs sm:shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type MetricTone = "teal" | "amber" | "violet" | "emerald";
type MetricIconName = "leads" | "today" | "value" | "won";

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: MetricIconName;
  tone: MetricTone;
}) {
  const iconTone: Record<MetricTone, string> = {
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  };

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${iconTone[tone]}`}>
          <MetricIcon name={icon} />
        </span>
      </div>
      <p className="mt-4 truncate text-2xl font-semibold tracking-tight tabular-nums text-slate-900 sm:text-[28px]">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

function MetricIcon({ name }: { name: MetricIconName }) {
  const common = {
    "aria-hidden": true as const,
    viewBox: "0 0 20 20",
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "leads") {
    return (
      <svg {...common}>
        <path d="M13.5 16.25v-1.4a3.1 3.1 0 0 0-3.1-3.1H5.35a3.1 3.1 0 0 0-3.1 3.1v1.4" />
        <circle cx="7.9" cy="6.1" r="2.75" />
        <path d="M14.2 3.55a2.8 2.8 0 0 1 0 5.35M16.9 16.25v-1.4a3.1 3.1 0 0 0-2.3-2.99" />
      </svg>
    );
  }
  if (name === "today") {
    return (
      <svg {...common}>
        <rect x="2.75" y="4.25" width="14.5" height="13" rx="2" />
        <path d="M6.5 2.75v3M13.5 2.75v3M2.75 8h14.5M6.5 11h.01M10 11h.01M13.5 11h.01M6.5 14.25h.01M10 14.25h.01" />
      </svg>
    );
  }
  if (name === "value") {
    return (
      <svg {...common}>
        <path d="M3 16.5V10m4.65 6.5V4m4.7 12.5V8m4.65 8.5V6" />
        <path d="M2 17.25h16" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="m6.5 10.1 2.2 2.2 4.8-4.8" />
    </svg>
  );
}
