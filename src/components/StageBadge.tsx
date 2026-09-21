import { STAGE_LABELS, type Stage } from "@/lib/types";

const COLORS: Record<Stage, string> = {
  new: "bg-sky-100 text-sky-800",
  qualified: "bg-violet-100 text-violet-800",
  follow_up: "bg-amber-100 text-amber-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-slate-100 text-slate-600",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[stage]}`}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
