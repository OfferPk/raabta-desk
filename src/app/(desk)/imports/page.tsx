"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type JobSummary = {
  id: string;
  filename: string;
  status: string;
  row_count: number;
  created_count: number;
  skipped_dupes: number;
  skipped_invalid: number;
  created_at: string;
  uploaded_by_name?: string;
};

export default function ImportsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    fetch("/api/imports")
      .then((r) => r.json())
      .then((d) => {
        if (d.jobs) setJobs(d.jobs);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/imports", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    router.push(`/imports/${data.job.id}/map`);
    router.refresh();
  }

  function jobHref(j: JobSummary) {
    if (j.status === "done" || j.status === "failed") {
      return `/imports/${j.id}/report`;
    }
    if (j.status === "previewed" || j.status === "mapped") {
      return `/imports/${j.id}/preview`;
    }
    return `/imports/${j.id}/map`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ads Drop</h1>
        <p className="text-sm text-slate-500">
          Upload a Meta Lead Ads / Instant Forms CSV or XLSX → map → preview →
          commit into your shared desk.
        </p>
      </div>

      <form onSubmit={onUpload} className="card space-y-3">
        <div>
          <label className="label" htmlFor="file">
            Meta export file (.csv / .xlsx) — max 5 MB, 2,000 rows
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="input"
            required
          />
        </div>
        <p className="text-xs text-slate-500">
          In Ads Manager: Ads → Leads → Download. No Meta API credentials needed.
        </p>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Uploading…" : "Upload & map"}
        </button>
      </form>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Recent imports
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No imports yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={jobHref(j)}
                    className="font-medium text-teal-700 hover:underline"
                  >
                    {j.filename}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {j.status} · {j.row_count} rows
                    {j.status === "done"
                      ? ` · +${j.created_count} / skip ${j.skipped_dupes + j.skipped_invalid}`
                      : ""}
                    {j.uploaded_by_name ? ` · ${j.uploaded_by_name}` : ""}
                  </p>
                </div>
                <Link href={jobHref(j)} className="btn-secondary text-xs">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
