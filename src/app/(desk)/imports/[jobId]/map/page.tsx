"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const TARGETS = [
  { value: "name", label: "Name" },
  { value: "phone", label: "Phone (required)" },
  { value: "email", label: "Email" },
  { value: "meta_lead_id", label: "Meta lead id" },
  { value: "meta_campaign", label: "Meta campaign" },
  { value: "created_at", label: "Created at" },
  { value: "note", label: "Append to import note" },
  { value: "ignore", label: "Ignore" },
] as const;

type TeamUser = { id: string; name: string; role: string };

export default function ImportMapPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [filename, setFilename] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [meRole, setMeRole] = useState("agent");
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [nudgeOn, setNudgeOn] = useState(true);
  const [nudgeHours, setNudgeHours] = useState(0);
  const [noteOnMatch, setNoteOnMatch] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewHint, setPreviewHint] = useState("");

  useEffect(() => {
    fetch(`/api/imports/${jobId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.job) {
          setError(d.error || "Job not found");
          return;
        }
        setFilename(d.job.filename);
        setHeaders(d.job.headers || []);
        setSampleRows(d.job.sample_rows || []);
        setMapping(d.job.mapping || {});
        if (d.job.default_owner_id) setOwnerId(d.job.default_owner_id);
        if (d.job.nudge_hours === null) setNudgeOn(false);
        else {
          setNudgeOn(true);
          setNudgeHours(Number(d.job.nudge_hours) || 0);
        }
        setNoteOnMatch(!!d.job.note_on_match);
      })
      .catch(() => setError("Failed to load job"));

    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => {
        if (d.me) {
          setMeRole(d.me.role);
          if (!ownerId) setOwnerId(d.me.id);
        }
        if (d.users) setUsers(d.users);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const sampleByHeader = useMemo(() => {
    const out: Record<string, string> = {};
    const row = sampleRows[0] || {};
    for (const h of headers) out[h] = row[h] || "";
    return out;
  }, [headers, sampleRows]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      mapping,
      default_owner_id: ownerId || undefined,
      nudge_hours: nudgeOn ? nudgeHours : null,
      note_on_match: noteOnMatch,
      save_preset_name: presetName.trim() || undefined,
    };
    const res = await fetch(`/api/imports/${jobId}/mapping`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error || "Could not save mapping");
      return;
    }
    if (data.preview) {
      setPreviewHint(
        `Would create ${data.preview.would_create}, dupe meta ${data.preview.would_dupe_meta}, dupe phone ${data.preview.would_dupe_phone}, invalid ${data.preview.would_invalid}`
      );
    }
    const prev = await fetch(`/api/imports/${jobId}/preview`, {
      method: "POST",
    });
    setBusy(false);
    if (!prev.ok) {
      const pe = await prev.json();
      setError(pe.error || "Preview failed");
      return;
    }
    router.push(`/imports/${jobId}/preview`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Map columns</h1>
          <p className="text-sm text-slate-500">{filename || jobId}</p>
        </div>
        <Link href="/imports" className="btn-secondary text-xs">
          All imports
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="py-2 pr-2">CSV header</th>
                <th className="py-2 pr-2">Sample</th>
                <th className="py-2">Maps to</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h) => (
                <tr key={h} className="border-b border-slate-50">
                  <td className="py-2 pr-2 font-medium">{h}</td>
                  <td className="max-w-[12rem] truncate py-2 pr-2 text-slate-500">
                    {sampleByHeader[h] || "—"}
                  </td>
                  <td className="py-2">
                    <select
                      className="input"
                      value={mapping[h] || "note"}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [h]: e.target.value }))
                      }
                    >
                      {TARGETS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card grid gap-3 sm:grid-cols-2">
          {meRole === "owner" && users.length > 0 && (
            <div>
              <label className="label">Default owner</label>
              <select
                className="input"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Follow-up nudge</label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={nudgeOn}
                  onChange={(e) => setNudgeOn(e.target.checked)}
                />
                Set next follow-up on created leads
              </label>
              {nudgeOn && (
                <select
                  className="input w-auto"
                  value={nudgeHours}
                  onChange={(e) => setNudgeHours(Number(e.target.value))}
                >
                  <option value={0}>Now (due today)</option>
                  <option value={2}>+2 hours</option>
                  <option value={4}>+4 hours</option>
                  <option value={24}>+24 hours</option>
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={noteOnMatch}
                onChange={(e) => setNoteOnMatch(e.target.checked)}
              />
              Append import note on phone match (no new lead)
            </label>
          </div>
          <div>
            <label className="label">Save mapping as preset (optional)</label>
            <input
              className="input"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Meta Instant Forms weekly"
            />
          </div>
        </div>

        {previewHint && (
          <p className="text-xs text-slate-500">{previewHint}</p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Preview"}
        </button>
      </form>
    </div>
  );
}
