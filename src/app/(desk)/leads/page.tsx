import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listLeads } from "@/lib/leads";
import { formatDateTime, formatMoney } from "@/lib/format";
import { STAGE_LABELS, STAGES, type Stage } from "@/lib/types";
import { StageBadge } from "@/components/StageBadge";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { WaMessageChips } from "@/components/WaMessageChips";

export const dynamic = "force-dynamic";

export default async function LeadsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    source?: string;
    meta_campaign?: string;
    owner_id?: string;
    archived?: string;
  }>;
}) {
  const user = (await getSessionUser())!;
  const sp = await searchParams;
  const stage =
    sp.stage && STAGES.includes(sp.stage as Stage)
      ? (sp.stage as Stage)
      : undefined;
  const showArchived = sp.archived === "1";

  let ownerId: string | undefined;
  if (user.role === "agent") {
    ownerId = user.id;
  } else if (sp.owner_id) {
    ownerId = sp.owner_id;
  }

  const leads = listLeads({
    ownerId,
    stage,
    q: sp.q,
    source: sp.source || undefined,
    meta_campaign: sp.meta_campaign || undefined,
    includeArchived: showArchived,
  });

  const owners =
    user.role === "owner"
      ? (getDb()
          .prepare("SELECT id, name FROM users ORDER BY name")
          .all() as { id: string; name: string }[])
      : [];

  const sources = getDb()
    .prepare(
      `SELECT DISTINCT source FROM leads
       WHERE source IS NOT NULL AND source != ''
       ORDER BY source`
    )
    .all() as { source: string }[];

  const campaigns = getDb()
    .prepare(
      `SELECT DISTINCT meta_campaign FROM leads
       WHERE meta_campaign IS NOT NULL AND meta_campaign != ''
       ORDER BY meta_campaign`
    )
    .all() as { meta_campaign: string }[];

  function hrefWith(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const next = {
      q: sp.q,
      stage: sp.stage,
      source: sp.source,
      meta_campaign: sp.meta_campaign,
      owner_id: sp.owner_id,
      archived: sp.archived,
      ...patch,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/leads?${qs}` : "/leads";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-slate-500">
            Search + filter — naam / phone / source / campaign
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/imports" className="btn-secondary text-xs">
            Ads Drop
          </Link>
          <Link href="/leads/new" className="btn-primary">
            + New lead
          </Link>
        </div>
      </div>

      <form className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3" method="get">
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            className="input"
            placeholder="Name, phone, or email…"
            defaultValue={sp.q || ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="stage">
            Stage
          </label>
          <select id="stage" name="stage" className="input" defaultValue={sp.stage || ""}>
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="source">
            Source
          </label>
          <select id="source" name="source" className="input" defaultValue={sp.source || ""}>
            <option value="">All sources</option>
            <option value="meta_ads">meta_ads</option>
            {sources
              .filter((s) => s.source !== "meta_ads")
              .map((s) => (
                <option key={s.source} value={s.source}>
                  {s.source}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="meta_campaign">
            Campaign
          </label>
          <select
            id="meta_campaign"
            name="meta_campaign"
            className="input"
            defaultValue={sp.meta_campaign || ""}
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.meta_campaign} value={c.meta_campaign}>
                {c.meta_campaign}
              </option>
            ))}
          </select>
        </div>
        {user.role === "owner" && (
          <div>
            <label className="label" htmlFor="owner_id">
              Owner
            </label>
            <select
              id="owner_id"
              name="owner_id"
              className="input"
              defaultValue={sp.owner_id || ""}
            >
              <option value="">All owners</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="archived"
              value="1"
              defaultChecked={showArchived}
            />
            Show archived
          </label>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="btn-primary">
            Apply filters
          </button>
          <Link href="/leads" className="btn-secondary">
            Clear
          </Link>
        </div>
      </form>

      {leads.length === 0 ? (
        <div className="card space-y-2 text-sm text-slate-600">
          <p>No leads match these filters.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/leads/new" className="btn-primary text-xs">
              Add lead
            </Link>
            <Link href="/imports" className="btn-secondary text-xs">
              Import Meta CSV
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {leads.map((l) => (
            <li key={l.id} className="card space-y-2 !p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/leads/${l.id}`}
                      className="font-medium hover:text-teal-700"
                    >
                      {l.name}
                    </Link>
                    <StageBadge stage={l.stage} />
                    {l.archived_at && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700">
                        Archived
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {l.phone}
                    {l.source ? ` · ${l.source}` : ""}
                    {l.meta_campaign ? ` · ${l.meta_campaign}` : ""}
                    {l.owner_name ? ` · ${l.owner_name}` : ""}
                    {" · "}
                    {formatMoney(l.value_cents, l.currency)}
                    {" · "}
                    {formatDateTime(l.updated_at)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <WhatsAppButton phone={l.phone} className="text-xs !py-1.5" />
                  <Link href={`/leads/${l.id}`} className="btn-secondary text-xs !py-1.5">
                    Open
                  </Link>
                </div>
              </div>
              <WaMessageChips phone={l.phone} />
            </li>
          ))}
        </ul>
      )}

      {showArchived && (
        <p className="text-xs text-slate-500">
          Showing archived too.{" "}
          <Link href={hrefWith({ archived: undefined })} className="text-teal-700 hover:underline">
            Hide archived
          </Link>
        </p>
      )}
    </div>
  );
}
