/**
 * Normalize a phone string to digits-only for wa.me links.
 * Strips spaces, dashes, parentheses, and a leading +.
 * Returns null if fewer than 8 digits remain.
 */
export function normalizePhoneDigits(phone: string): string | null {
  if (!phone || typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

/**
 * PK local mobiles often arrive as 03XXXXXXXXX (11 digits).
 * Rewrite to country-code form 92XXXXXXXXX before storage.
 */
export function rewritePkLocalPhone(digits: string): string {
  if (digits.startsWith("03") && digits.length === 11) {
    return "92" + digits.slice(1);
  }
  return digits;
}

/**
 * Prepare a phone for create/update: strip non-digits, auto-rewrite
 * PK 03… → 92…, then validate via normalizePhoneDigits.
 * Returns digits to persist, or null if invalid.
 */
export function preparePhoneForStorage(phone: string): string | null {
  if (!phone || typeof phone !== "string") return null;
  const raw = phone.replace(/\D/g, "");
  const rewritten = rewritePkLocalPhone(raw);
  return normalizePhoneDigits(rewritten);
}

/**
 * Build https://wa.me/<digits> from a phone string, or null if invalid.
 * Optional `text` appends ?text= (encodeURIComponent) for prefilled compose.
 */
export function toWhatsAppUrl(phone: string, text?: string): string | null {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (text && text.trim()) {
    return `${base}?text=${encodeURIComponent(text.trim())}`;
  }
  return base;
}

/**
 * Light guidance: Pakistan mobiles often start with 03… (local) —
 * users should prefer country code 92… for wa.me.
 */
export function phoneHint(phone: string): string | null {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "Enter a phone with country code (e.g. 923001234567).";
  if (digits.startsWith("03") && digits.length === 11) {
    return "Looks like a local PK number. Prefer 92… (drop the leading 0) for WhatsApp.";
  }
  return null;
}

/** Shared 400 message when phone fails quality checks. */
export const PHONE_REQUIRED_HINT =
  "Valid phone with country code required (e.g. 923001234567)";
