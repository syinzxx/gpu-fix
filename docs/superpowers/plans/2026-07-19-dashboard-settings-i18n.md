# Dashboard Settings Expansion + Arabic Localization Completion

## Context

The dashboard Settings page has only four shop-info fields; the public site's
social links (Facebook/YouTube/TikTok/Discord) and WhatsApp number are
env-only, so the shop owner can't edit them without touching `.env`. Separately,
several dashboard pages remain hardcoded English despite the app's full en/ar
i18n system (tickets list, inventory, expenses, suppliers, purchase orders,
users, and the "new" forms).

Execution model: Sonnet subagents implement; Fable supervises, dispatches
Opus spec + quality reviews per task, and verifies. Tasks run SEQUENTIALLY
because both edit `lib/i18n.ts` (single-owner-per-task rule).

## Task A — Settings expansion: social links + WhatsApp in DB

- `prisma/schema.prisma` Settings model: add `whatsappNumber`, `socialFacebook`,
  `socialYoutube`, `socialTiktok`, `socialDiscord` — all `String @default("")`
  (mirror shopAddress pattern). Run `npm run db:push`; controller restarts dev server.
- `lib/settings.ts`: return the five new fields with env fallbacks:
  whatsappNumber ← SHOP_WHATSAPP, socialFacebook ← SOCIAL_FACEBOOK_URL,
  socialYoutube ← SOCIAL_YOUTUBE_URL, socialTiktok ← SOCIAL_TIKTOK_URL,
  socialDiscord ← SOCIAL_DISCORD_URL.
- `app/actions/admin.ts` saveSettings: five new fields in BOTH upsert branches
  (same `?.trim() || ""` pattern).
- `app/dashboard/settings/page.tsx`: reorganize into two Cards — "Shop info"
  (existing four fields) and "Contact & social" (whatsappNumber + four social
  URL inputs, `type="url"` where appropriate, platform names as literal labels —
  brand names don't get translated). One form per card or one form spanning both
  — follow simplest correct pattern (single form wrapping both cards is fine).
- `lib/i18n.ts` (owned by this task): add keys `contactSocial` (section title),
  `whatsappNumberLabel`, `whatsappNumberHint` (e.g. "Used for the chat button on
  the website; falls back to the shop phone"), `socialHint` ("Leave empty to
  hide the button on the website"). en + natural ar.
- `components/social-links.tsx`: make async server component reading
  `getSettings()`; per-platform URL = settings value (env fallback already folded
  into settings) — if empty, HIDE that button (replaces today's
  platform-homepage fallback, per socialHint promise). Consumers (site-header,
  site-footer) are already async server components.
- `lib/phone.ts` `resolveWhatsappNumber`: new chain
  env SHOP_WHATSAPP || settings.whatsappNumber || env SHOP_PHONE || settings.shopPhone.
  Change signature to `resolveWhatsappNumber(settings: { whatsappNumber: string; shopPhone: string })`
  and update both callers (components/whatsapp-button.tsx, app/page.tsx).

Verify: tsc; db push; settings round-trip via DB; homepage header/footer social
buttons driven by settings (set one value, one empty → hidden); wa.me links still
correct in both locales.

## Task B — Finish dashboard Arabic localization

Localize every dashboard page still hardcoded English. Known: tickets list,
inventory list, expenses; audit each of: suppliers, purchase-orders (+ new),
users, customers list, tickets/new, inventory/new, inventory/[id]. Pattern to
follow: existing localized pages (dashboard/page.tsx, reports, settings) —
`getT()` via `Promise.all`, `t.*` keys, logical CSS properties already in place.

- This task OWNS `lib/i18n.ts`: add missing keys (en + natural ar) as needed;
  reuse existing keys where present (~200 already, incl. nav labels, common
  terms); no duplicate keys.
- Do not change page logic/queries — string replacement + getT wiring only.
- STATUS_LABELS / PRIORITY badges: tickets list likely uses StatusBadge which
  may already be handled — do not refactor shared constants; if a page renders
  raw STATUS_LABELS, use the same locale-conditional approach the track page
  uses (or reuse its arStatusLabels map if exported — do NOT create a second
  divergent copy; if it's local to the track page, lift it into lib/i18n or
  lib/constants once, minimally).

Verify: tsc (key parity); lint; spot-check by code read (dashboard requires
auth, so browser verification is limited); reviewers confirm no page logic
changed.

## Sequencing

A → reviews → B → reviews → final verification + report.
