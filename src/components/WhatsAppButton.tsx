import { toWhatsAppUrl } from "@/lib/phone";

export function WhatsAppButton({
  phone,
  text,
  label = "WhatsApp",
  className = "",
}: {
  phone: string;
  text?: string;
  label?: string;
  className?: string;
}) {
  const url = toWhatsAppUrl(phone, text);
  if (!url) {
    return (
      <span className="text-xs text-slate-400" title="Invalid phone">
        No WA link
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn-wa ${className}`}
    >
      {label}
    </a>
  );
}
