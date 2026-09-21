/** Escape CSV cell; neutralize spreadsheet formula injection (= + - @). */
export function csvEscape(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) {
    s = "'" + s;
  }
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
