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
    <div className="card !p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        Pipeline health
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Link
          href="/follow-ups"
          className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 hover:border-red-200"
        >
          <div className="text-xs text-slate-500">Overdue follow-ups</div>
          <div className="text-lg font-semibold tabular-nums text-red-800">
            {overdue}
          </div>
          <div className="text-xs text-slate-600">
            {formatMoney(overdueValueCents, currency)} at risk
          </div>
        </Link>
        <Link
          href="/leads?source=meta_ads"
          className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 hover:border-amber-200"
        >
          <div className="text-xs text-slate-500">
            Stale leads (&gt;{staleDays}d no update)
          </div>
          <div className="text-lg font-semibold tabular-nums text-amber-900">
            {staleLeads}
          </div>
          <div className="text-xs text-slate-600">Open pipeline · Meta filter</div>
        </Link>
        <Link
          href="/imports"
          className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2 hover:border-teal-200"
        >
          <div className="text-xs text-slate-500">Imports this week</div>
          <div className="text-lg font-semibold tabular-nums text-teal-900">
            {importsThisWeek}
          </div>
          <div className="text-xs text-slate-600">Ads Drop commits</div>
        </Link>
      </div>
    </div>
  );
}
