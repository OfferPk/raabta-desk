"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Preview = {
  would_create: number;
  would_dupe_meta: number;
  would_dupe_phone: number;
  would_invalid: number;
  would_note_on_match?: number;
};

type Sample = {
  row_number: number;
  meta_lead_id: string | null;
  phone: string | null;
  name: string | null;
  outcome: string;
  message: string | null;
};

export default function ImportPreviewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/imports/${jobId}/preview`, { method: "POST" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || "Preview failed");
          return;
        }
        setPreview(d.preview);
        setSamples(d.sample_outcomes || []);
        setFilename(d.job?.filename || "");
      })
      .catch(() => setError("Preview failed"));
  }, [jobId]);

  async function commit() {
    if (!confirm("Commit this import? This creates leads.")) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/imports/${jobId}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Commit failed");
      return;
    }
    router.push(`/imports/${jobId}/report`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Preview import</h1>
          <p className="text-sm text-slate-500">{filename || jobId}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/imports/${jobId}/map`} className="btn-secondary text-xs">
            Back to map
          </Link>
          <Link href="/imports" className="btn-secondary text-xs">
            All imports
          </Link>
        </div>
      </div>

      {preview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Would create" value={preview.would_create} tone="good" />
          <Stat label="Dupe meta id" value={preview.would_dupe_meta} />
          <Stat label="Dupe phone" value={preview.would_dupe_phone} />
          <Stat label="Invalid phone" value={preview.would_invalid} tone="bad" />
        </div>
      )}

      <div className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-semibold">Sample outcomes (up to 20)</h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="py-2">#</th>
              <th className="py-2">Name</th>
              <th className="py-2">Phone</th>
              <th className="py-2">Meta id</th>
              <th className="py-2">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s) => (
              <tr key={s.row_number} className="border-b border-slate-50">
                <td className="py-1.5">{s.row_number}</td>
                <td className="py-1.5">{s.name || "—"}</td>
                <td className="py-1.5 font-mono text-xs">{s.phone || "—"}</td>
                <td className="py-1.5 font-mono text-xs">
                  {s.meta_lead_id || "—"}
                </td>
                <td className="py-1.5">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {s.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-primary"
        disabled={busy || !preview}
        onClick={commit}
      >
        {busy ? "Importing…" : "Commit import"}
      </button>
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
