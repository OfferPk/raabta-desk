"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Job = {
  filename: string;
  status: string;
  created_count: number;
  skipped_dupes: number;
  skipped_invalid: number;
  note_on_match_count: number;
  error_count: number;
  nudge_hours: number | null;
};

type Row = {
  row_number: number;
  meta_lead_id: string | null;
  phone_norm: string | null;
  phone_raw: string | null;
  outcome: string;
  lead_id: string | null;
  message: string | null;
};

export default function ImportReportPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/imports/${jobId}?include_rows=1`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || "Failed to load report");
          return;
        }
        setJob(d.job);
        setRows(d.rows || []);
      })
      .catch(() => setError("Failed to load report"));
  }, [jobId]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.outcome === filter);
  }, [rows, filter]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Import report</h1>
          <p className="text-sm text-slate-500">
            {job?.filename || jobId} · {job?.status}
          </p>
        </div>
        <Link href="/imports" className="btn-secondary text-xs">
          All imports
        </Link>
      </div>

      {job && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Created" value={job.created_count} tone="good" />
          <Stat label="Skipped dupes" value={job.skipped_dupes} />
          <Stat label="Invalid" value={job.skipped_invalid} tone="bad" />
          <Stat label="Note on match" value={job.note_on_match_count} />
          <Stat label="Errors" value={job.error_count} tone="bad" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/imports/${jobId}/report.csv`}
          className="btn-secondary text-xs"
        >
          Download report CSV
        </a>
        {job && job.nudge_hours !== null && (
          <Link href="/follow-ups" className="btn-primary text-xs">
            View Follow-ups
          </Link>
        )}
        <Link href="/board" className="btn-secondary text-xs">
          Open Board
        </Link>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="label mb-0">Filter outcome</label>
          <select
            className="input w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="created">created</option>
            <option value="duplicate_meta_id">duplicate_meta_id</option>
            <option value="duplicate_phone">duplicate_phone</option>
            <option value="invalid">invalid</option>
            <option value="note_on_match">note_on_match</option>
            <option value="error">error</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="py-2">#</th>
                <th className="py-2">Phone</th>
                <th className="py-2">Meta id</th>
                <th className="py-2">Outcome</th>
                <th className="py-2">Lead</th>
                <th className="py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.row_number} className="border-b border-slate-50">
                  <td className="py-1.5">{r.row_number}</td>
                  <td className="py-1.5 font-mono text-xs">
                    {r.phone_norm || r.phone_raw || "—"}
                  </td>
                  <td className="py-1.5 font-mono text-xs">
                    {r.meta_lead_id || "—"}
                  </td>
                  <td className="py-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {r.outcome}
                    </span>
                  </td>
                  <td className="py-1.5">
                    {r.lead_id ? (
                      <Link
                        href={`/leads/${r.lead_id}`}
                        className="text-teal-700 hover:underline"
                      >
                        Open
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1.5 text-xs text-slate-500">
                    {r.message || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-teal-700"
      : tone === "bad"
        ? "text-red-700"
        : "text-slate-800";
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
