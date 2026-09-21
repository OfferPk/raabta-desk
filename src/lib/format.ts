/** Format value_cents as currency string (default PKR). */
export function formatMoney(cents: number, currency = "PKR"): string {
  const amount = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "PKR" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** Start of today (local) as ISO for comparisons. */
export function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** End of today (local) as ISO. */
export function endOfTodayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
