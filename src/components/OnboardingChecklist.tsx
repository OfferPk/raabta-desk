"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STEPS = [
  {
    n: 1,
    en: "Import Meta leads via Ads Drop",
    ur: "Ads Drop se Meta leads import karo",
    href: "/imports",
    cta: "Open Ads Drop",
  },
  {
    n: 2,
    en: "Clear follow-ups due today / overdue",
    ur: "Aaj ke due aur overdue follow-ups clear karo",
    href: "/follow-ups",
    cta: "Open follow-ups",
  },
  {
    n: 3,
    en: "Add a lead or open the pipeline board",
    ur: "Nayi lead add karo ya Board pe pipeline dekho",
    href: "/leads/new",
    cta: "New lead",
  },
];

export function OnboardingChecklist({
  show,
  initiallyDismissed = false,
}: {
  show: boolean;
  initiallyDismissed?: boolean;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(initiallyDismissed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!show || dismissed) return null;

  async function dismiss() {
    setBusy(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_dismissed: true }),
    });
    setBusy(false);
    setDismissed(true);
  }

  async function seedSample() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/leads/sample", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create sample");
      return;
    }
    router.push(`/leads/${data.lead.id}`);
    router.refresh();
  }

  return (
    <div className="card border-teal-200 bg-gradient-to-br from-teal-50/80 to-white space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-teal-900">
            Get started in 60 seconds
          </h2>
          <p className="text-xs text-teal-800/80">
            60 second mein shuru — Ads Drop + follow-ups
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-700"
          disabled={busy}
          onClick={dismiss}
        >
          Dismiss / Chhupa do
        </button>
      </div>
      <ol className="space-y-2">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                {s.n}
              </span>
              <span className="font-medium text-slate-800">{s.en}</span>
              <div className="ml-7 text-xs text-slate-500">{s.ur}</div>
            </div>
            <Link href={s.href} className="btn-secondary !py-1 !px-2 text-xs">
              {s.cta}
            </Link>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={busy}
          onClick={seedSample}
        >
          + Seed sample lead / Sample lead banao
        </button>
        <Link href="/board" className="text-xs text-teal-700 hover:underline">
          View board
        </Link>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
