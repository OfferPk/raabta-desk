"use client";

import { WA_MESSAGE_CHIPS } from "@/lib/wa-chips";
import { toWhatsAppUrl } from "@/lib/phone";

export function WaMessageChips({
  phone,
  className = "",
}: {
  phone: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {WA_MESSAGE_CHIPS.map((c) => {
        const url = toWhatsAppUrl(phone, c.text);
        if (!url) return null;
        return (
          <a
            key={c.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary !py-1 !px-2 text-[11px]"
            title={c.text}
          >
            {c.label}
          </a>
        );
      })}
    </div>
  );
}
