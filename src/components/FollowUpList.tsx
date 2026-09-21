"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Lead } from "@/lib/types";
import { formatDateTime, formatMoney, startOfTodayISO } from "@/lib/format";
import { StageBadge } from "./StageBadge";
import { WhatsAppButton } from "./WhatsAppButton";
import { WaMessageChips } from "./WaMessageChips";

export function FollowUpList({ leads: initial }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const start = startOfTodayISO();

  async function markDone(id: string) {
    setBusy(id);
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_follow_up: null }),
    });
    setBusy(null);
    if (!res.ok) {
      alert("Could not clear follow-up");
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== id));
    router.refresh();
  }

  async function snoozeTomorrow(id: string) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    setBusy(id);
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_follow_up: d.toISOString() }),
    });
    setBusy(null);
    if (!res.ok) {
      alert("Could not snooze");
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== id));
    router.refresh();
  }

  if (leads.length === 0) {
    return (
      <p className="card text-sm text-slate-500">
        No follow-ups due today or overdue. You&apos;re clear!
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {leads.map((l) => {
        const overdue = l.next_follow_up && l.next_follow_up < start;
        return (
          <li key={l.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/leads/${l.id}`}
                  className="font-medium hover:text-teal-700"
                >
                  {l.name}
                </Link>
                <StageBadge stage={l.stage} />
                {overdue ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                    Overdue
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    Due today
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {formatDateTime(l.next_follow_up)} ·{" "}
                {formatMoney(l.value_cents, l.currency)}
                {l.owner_name ? ` · ${l.owner_name}` : ""}
              </div>
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-auto">
              <div className="flex flex-wrap gap-1.5">
              <WhatsAppButton phone={l.phone} className="text-xs !py-1.5" />
              <button
                type="button"
                className="btn-secondary text-xs !py-1.5"
                disabled={busy === l.id}
                onClick={() => snoozeTomorrow(l.id)}
              >
                Tomorrow
              </button>
              <button
                type="button"
                className="btn-primary text-xs !py-1.5"
                disabled={busy === l.id}
                onClick={() => markDone(l.id)}
              >
                Done
              </button>
              </div>
              <WaMessageChips phone={l.phone} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
