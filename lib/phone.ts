/**
 * Normalizes a phone number to E.164 format.
 *
 * Egypt-specific rules:
 *   - Strip spaces, dashes, parentheses, and leading "+"
 *   - 01XXXXXXXXX (11 digits starting with 01) → 201XXXXXXXXX
 *   - Already starting with 20 → keep as-is
 *   - Other international numbers → digits as-is
 */
export function normalizePhone(raw: string): string {
  // Strip everything except digits
  const digits = raw.replace(/[\s\-\(\)\+]/g, "");

  // Egyptian local format: 01XXXXXXXXX (11 digits starting with 01)
  if (/^01\d{9}$/.test(digits)) {
    return "20" + digits.slice(1); // drop leading 0, prepend country code
  }

  // Already E.164 Egypt (20 + 10 digits)
  if (/^20\d{10}$/.test(digits)) {
    return digits;
  }

  // Any other number — return digits as-is (caller's responsibility)
  return digits;
}

/**
 * Resolves the shop's WhatsApp number from env overrides, falling back to the
 * saved settings phone. Uses || (not ??) so empty strings fall through.
 *
 * Server-only in practice: SHOP_WHATSAPP / SHOP_PHONE are non-NEXT_PUBLIC env
 * vars, so they only resolve on the server. Call this from server components.
 */
export function resolveWhatsappNumber(settingsPhone: string): string | null {
  return (
    process.env.SHOP_WHATSAPP || process.env.SHOP_PHONE || settingsPhone || null
  );
}

/** Builds a wa.me chat link with a prefilled message. */
export function waMeLink(rawNumber: string, text: string): string {
  return `https://wa.me/${normalizePhone(rawNumber)}?text=${encodeURIComponent(text)}`;
}
