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
 * Resolves the shop's WhatsApp number from the settings returned by
 * getSettings(), which already folds in the env fallbacks (SHOP_WHATSAPP /
 * SHOP_PHONE) — DB wins, like every other setting.
 *
 * Chain: settings.whatsappNumber -> settings.shopPhone -> null. Uses ||
 * (not ??) so empty strings fall through.
 */
export function resolveWhatsappNumber(settings: { whatsappNumber: string; shopPhone: string }): string | null {
  return settings.whatsappNumber || settings.shopPhone || null;
}

/** Builds a wa.me chat link with a prefilled message. */
export function waMeLink(rawNumber: string, text: string): string {
  return `https://wa.me/${normalizePhone(rawNumber)}?text=${encodeURIComponent(text)}`;
}
