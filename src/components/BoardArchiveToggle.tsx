"use client";

import Link from "next/link";

export function BoardArchiveToggle({ showArchived }: { showArchived: boolean }) {
  if (showArchived) {
    return (
      <Link href="/board" className="btn-secondary text-xs">
        Hide archived
      </Link>
    );
  }
  return (
    <Link href="/board?archived=1" className="btn-secondary text-xs">
      Show archived
    </Link>
  );
}
