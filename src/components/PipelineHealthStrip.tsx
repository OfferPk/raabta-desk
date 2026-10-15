import Link from "next/link";
import { formatMoney } from "@/lib/format";

export function PipelineHealthStrip({
  overdue,
  overdueValueCents,
  currency,
  staleLeads,
  importsThisWeek,
  staleDays = 7,
}: {
  overdue: number;
  overdueValueCents: number;
  currency: string;
  staleLeads: number;
  importsThisWeek: number;
  staleDays?: number;
}) {
  return (
    <section className="card !p-4 sm:!p-5" aria-labelledby="health-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">A quick pulse check</p>
          <h2 id="health-title" className="mt-1 text-sm font-semibold text-slate-900">Activity to review</h2>
        </div>
        <span className="text-xs text-slate-400">Updated from your desk</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Link
          href="/follow-ups"
          className="group rounded-xl border border-rose-100 bg-rose-50/60 px-3.5 py-3 transition hover:border-rose-200 hover:bg-rose-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-slate-600">Overdue follow-ups</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-rose-800">{overdue}</div>
            </div>
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-rose-600 ring-1 ring-rose-100">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="10" cy="10" r="6.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v4l2.5 1.5" />
              </svg>
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{formatMoney(overdueValueCents, currency)} still at risk</div>
        </Link>
        <Link
          href="/leads?source=meta_ads"
          className="group rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-3 transition hover:border-amber-200 hover:bg-amber-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-slate-600">Leads with no recent update</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-amber-900">{staleLeads}</div>
            </div>
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-amber-700 ring-1 ring-amber-100">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15.5h14M4.5 12l3.2-3.2 2.6 2.1 5.2-6.1" />
                <path strokeLinecap="round" d="M12.5 4.8h3v3" />
              </svg>
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Open pipeline · older than {staleDays} days</div>
        </Link>
        <Link
          href="/imports"
          className="group rounded-xl border border-teal-100 bg-teal-50/60 px-3.5 py-3 transition hover:border-teal-200 hover:bg-teal-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-slate-600">Ads Drop imports this week</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-teal-900">{importsThisWeek}</div>
            </div>
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-teal-700 ring-1 ring-teal-100">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 13V3.5m0 0L6.5 7M10 3.5 13.5 7M3 11.5v3.25A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75V11.5" />
              </svg>
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">Keep lead sourcing consistent</div>
        </Link>
      </div>
    </section>
  );
}
