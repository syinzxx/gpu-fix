import { getSettings } from "@/lib/settings";
import { normalizePhone } from "@/lib/phone";
import { translations } from "@/lib/i18n";

// English, keyword-bearing service names for structured data — search engines
// and AI crawlers read this regardless of the visitor's locale.
const SERVICE_NAMES = [
  "GPU no display repair",
  "GPU artifacting repair / VRAM replacement",
  "GPU core reballing",
  "GPU fan & thermal service",
  "VBIOS repair & flashing",
  "GPU water damage treatment",
] as const;

export async function LocalBusinessJsonLd() {
  const settings = await getSettings();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${base}/#business`,
    name: settings.shopName,
    description: translations.en.metaHomeDescription,
    url: base,
    image: `${base}/icon.svg`,
    makesOffer: SERVICE_NAMES.map((name) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name,
      },
    })),
  };

  if (settings.shopPhone) {
    jsonLd.telephone = `+${normalizePhone(settings.shopPhone)}`;
  }

  if (settings.shopAddress) {
    jsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: settings.shopAddress,
    };
  }

  if (settings.shopHours) {
    jsonLd.openingHours = settings.shopHours;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
