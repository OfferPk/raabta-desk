"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STAGES,
  STAGE_LABELS,
  type Lead,
  type Note,
  type Stage,
} from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { phoneHint } from "@/lib/phone";
import { WhatsAppButton } from "./WhatsAppButton";
import { StageBadge } from "./StageBadge";

export function LeadDetail({
  lead: initial,
  notes: initialNotes,
  users,
  canDelete,
}: {
  lead: Lead;
  notes: Note[];
  users: { id: string; name: string }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initial);
  const [notes, setNotes] = useState(initialNotes);
  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const nextFollow = String(fd.get("next_follow_up") || "");
    const body = {
      name: String(fd.get("name") || ""),
      phone: String(fd.get("phone") || ""),
      email: String(fd.get("email") || "") || null,
      source: String(fd.get("source") || "") || null,
      stage: String(fd.get("stage") || lead.stage) as Stage,
      value: Number(fd.get("value") || 0),
      currency: String(fd.get("currency") || "PKR"),
      next_follow_up: nextFollow
        ? new Date(nextFollow).toISOString()
        : null,
      owner_id: fd.get("owner_id")
        ? String(fd.get("owner_id"))
        : undefined,
    };
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    setLead(data.lead);
    setEditing(false);
    router.refresh();
  }

  async function changeStage(stage: Stage) {
    setBusy(true);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setLead(data.lead);
      router.refresh();
    }
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not add note");
      return;
    }
    setNotes((n) => [...n, data.note]);
    setNoteBody("");
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this lead permanently?")) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/board");
      router.refresh();
    }
  }

  function toLocalInput(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{lead.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <StageBadge stage={lead.stage} />
            <span>{formatMoney(lead.value_cents, lead.currency)}</span>
            {lead.owner_name && <span>· {lead.owner_name}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <WhatsAppButton phone={lead.phone} />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          {canDelete && (
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={remove}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy || lead.stage === s}
            onClick={() => changeStage(s)}
            className={`btn-secondary text-xs ${
              lead.stage === s ? "ring-2 ring-teal-400" : ""
            }`}
          >
            {STAGE_LABELS[s]}
          </button>
        ))}
      </div>

      {!editing ? (
        <div className="card grid gap-2 text-sm sm:grid-cols-2">
          <Field label="Phone" value={lead.phone} />
          <Field label="Email" value={lead.email || "—"} />
          <Field label="Source" value={lead.source || "—"} />
          <Field
            label="Next follow-up"
            value={formatDateTime(lead.next_follow_up)}
          />
          <Field label="Created" value={formatDateTime(lead.created_at)} />
          <Field label="Updated" value={formatDateTime(lead.updated_at)} />
          {lead.meta_lead_id ? (
            <Field label="Meta lead id" value={lead.meta_lead_id} />
          ) : null}
          {lead.meta_campaign ? (
            <Field label="Meta campaign" value={lead.meta_campaign} />
          ) : null}
          {phoneHint(lead.phone) && (
            <p className="sm:col-span-2 text-xs text-amber-700">
              {phoneHint(lead.phone)}
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={saveEdit} className="card space-y-3">
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" defaultValue={lead.name} required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" defaultValue={lead.phone} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" className="input" defaultValue={lead.email || ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Source</label>
              <input name="source" className="input" defaultValue={lead.source || ""} />
            </div>
            <div>
              <label className="label">Stage</label>
              <select name="stage" className="input" defaultValue={lead.stage}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Deal value</label>
              <input
                name="value"
                type="number"
                className="input"
                defaultValue={lead.value_cents / 100}
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <input name="currency" className="input" defaultValue={lead.currency} />
            </div>
          </div>
          <div>
            <label className="label">Next follow-up</label>
            <input
              name="next_follow_up"
              type="datetime-local"
              className="input"
              defaultValue={toLocalInput(lead.next_follow_up)}
            />
          </div>
          {users.length > 0 && (
            <div>
              <label className="label">Owner</label>
              <select name="owner_id" className="input" defaultValue={lead.owner_id}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={busy}>
            Save changes
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Activity notes</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="text-xs text-slate-500">
                  {n.user_name || "User"} · {formatDateTime(n.created_at)}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addNote} className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="Add a note after your chat…"
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={busy || !noteBody.trim()}>
            Add note
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium text-slate-800">{value}</div>
    </div>
  );
}
