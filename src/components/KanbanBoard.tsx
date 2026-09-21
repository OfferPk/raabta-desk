"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAGE_LABELS, STAGES, type Lead, type Stage } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { WhatsAppButton } from "./WhatsAppButton";
import { StageBadge } from "./StageBadge";

export function KanbanBoard({ leads: initial }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  async function move(id: string, stage: Stage) {
    setBusyId(id);
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    setBusyId(null);
    if (!res.ok) {
      alert("Could not update stage");
      return;
    }
    const data = await res.json();
    setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
    router.refresh();
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {STAGES.map((stage) => {
        const col = leads.filter((l) => l.stage === stage);
        return (
          <div
            key={stage}
            className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50/80"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700">
                {STAGE_LABELS[stage]}
              </span>
              <span className="rounded-full bg-white px-2 text-xs text-slate-500">
                {col.length}
              </span>
            </div>
            <div className="space-y-2 p-2 min-h-[120px]">
              {col.map((lead) => (
                <div key={lead.id} className="card !p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-sm hover:text-teal-700"
                    >
                      {lead.name}
                    </Link>
                    <StageBadge stage={lead.stage} />
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatMoney(lead.value_cents, lead.currency)}
                    {lead.owner_name ? ` · ${lead.owner_name}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <WhatsAppButton phone={lead.phone} className="!py-1 !px-2 text-xs" />
                    {STAGES.filter((s) => s !== lead.stage).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busyId === lead.id}
                        onClick={() => move(lead.id, s)}
                        className="btn-secondary !py-1 !px-2 text-[11px]"
                        title={`Move to ${STAGE_LABELS[s]}`}
                      >
                        → {STAGE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {col.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-slate-400">
                  Empty
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
