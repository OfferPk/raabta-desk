"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  email?: string;
  name: string;
  role: string;
  created_at: string;
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(true);

  function load() {
    fetch("/api/users")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || "Failed");
          return;
        }
        if (d.me?.role !== "owner") {
          setAllowed(false);
          return;
        }
        setUsers(d.users || []);
      })
      .catch(() => setError("Failed to load team"));
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        password: fd.get("password"),
        role: "agent",
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create user");
      return;
    }
    (e.target as HTMLFormElement).reset();
    load();
    router.refresh();
  }

  if (!allowed) {
    return (
      <p className="card text-sm text-red-700">
        Only the workspace owner can manage team members.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-slate-500">
          Create agent accounts for your sales team
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Members</h2>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="flex justify-between py-2 text-sm">
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">
                {u.role}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={onCreate} className="card space-y-3">
        <h2 className="text-sm font-semibold">Add agent</h2>
        <div>
          <label className="label">Name</label>
          <input name="name" className="input" required />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" required />
        </div>
        <div>
          <label className="label">Password (min 10)</label>
          <input name="password" type="password" minLength={10} className="input" required />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Creating…" : "Create agent"}
        </button>
      </form>
    </div>
  );
}
