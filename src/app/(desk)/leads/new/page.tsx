"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/types";
import { phoneHint } from "@/lib/phone";

type TeamUser = { id: string; name: string; role: string };

export default function NewLeadPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [meRole, setMeRole] = useState<string>("agent");
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [ownerId, setOwnerId] = useState("");

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => {
        if (d.me) setMeRole(d.me.role);
        if (d.users) setUsers(d.users);
        if (d.me) setOwnerId(d.me.id);
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
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
      stage: String(fd.get("stage") || "new") as Stage,
      value: Number(fd.get("value") || 0),
      currency: String(fd.get("currency") || "PKR"),
      next_follow_up: nextFollow
        ? new Date(nextFollow).toISOString()
        : null,
      owner_id: ownerId || undefined,
    };
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create lead");
      return;
    }
    router.push(`/leads/${data.lead.id}`);
    router.refresh();
  }

  const hint = phone ? phoneHint(phone) : null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold">New lead</h1>
        <p className="text-sm text-slate-500">
          Capture quickly — add notes after the chat
        </p>
      </div>
      <form onSubmit={onSubmit} className="card space-y-3">
        <div>
          <label className="label" htmlFor="name">
            Name *
          </label>
          <input id="name" name="name" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone * (with country code, e.g. 923001234567)
          </label>
          <input
            id="phone"
            name="phone"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="923001234567"
            required
          />
          {hint && <p className="mt-1 text-xs text-amber-700">{hint}</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="source">
              Source
            </label>
            <input
              id="source"
              name="source"
              className="input"
              placeholder="WhatsApp, referral…"
            />
          </div>
          <div>
            <label className="label" htmlFor="stage">
              Stage
            </label>
            <select id="stage" name="stage" className="input" defaultValue="new">
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
            <label className="label" htmlFor="value">
              Deal value
            </label>
            <input
              id="value"
              name="value"
              type="number"
              min={0}
              step={1}
              className="input"
              defaultValue={0}
            />
          </div>
          <div>
            <label className="label" htmlFor="currency">
              Currency
            </label>
            <input
              id="currency"
              name="currency"
              className="input"
              defaultValue="PKR"
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="next_follow_up">
            Next follow-up
          </label>
          <input
            id="next_follow_up"
            name="next_follow_up"
            type="datetime-local"
            className="input"
          />
        </div>
        {meRole === "owner" && users.length > 0 && (
          <div>
            <label className="label" htmlFor="owner">
              Owner
            </label>
            <select
              id="owner"
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
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Save lead"}
        </button>
      </form>
    </div>
  );
}
