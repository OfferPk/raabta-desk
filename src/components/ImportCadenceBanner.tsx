"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";

export function ImportCadenceBanner({
  show,
  remindDays,
  lastImportAt,
  isOwner,
}: {
  show: boolean;
  remindDays: number;
  lastImportAt: string | null;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [days, setDays] = useState(remindDays);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (!show || hidden) return null;

  async function saveDays() {
    if (!isOwner) return;
    setBusy(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ import_remind_days: days }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            Ads Drop reminder — no import in {remindDays} day
            {remindDays === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-amber-900/80">
            Meta CSV dubara upload karo taake naye leads miss na hon.{" "}
            {lastImportAt
              ? `Last import: ${formatDateTime(lastImportAt)}`
              : "Abhi tak koi import commit nahi hua."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/imports" className="btn-primary !py-1.5 text-xs">
            Open Ads Drop
          </Link>
          <button
            type="button"
            className="btn-secondary !py-1.5 text-xs"
            onClick={() => setHidden(true)}
          >
            Later
          </button>
        </div>
      </div>
      {isOwner && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label htmlFor="remind-days" className="text-amber-900/80">
            Remind if no import in
          </label>
          <input
            id="remind-days"
            type="number"
            min={1}
            max={90}
            className="input !w-16 !py-1 text-xs"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 3)}
          />
          <span>days</span>
          <button
            type="button"
            className="btn-secondary !py-1 text-xs"
            disabled={busy}
            onClick={saveDays}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
