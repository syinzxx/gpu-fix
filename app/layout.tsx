import type { Metadata } from "next";
import { Orbitron, Rajdhani, Share_Tech_Mono, Cairo } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/locale";

// Brand type: Orbitron (display), Rajdhani (body), Share Tech Mono (codes/readouts).
// Cairo is the glyph fallback for Arabic, which the brand fonts don't cover.
const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech",
  subsets: ["latin"],
  weight: "400",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
});

const shopName = process.env.SHOP_NAME ?? "GPU Fix Shop";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: shopName, template: `%s · ${shopName}` },
  description:
    "Professional GPU repair services — no display fixes, VRAM replacement, GPU core reballing, fan and thermal service, VBIOS repair and flashing, and water damage treatment. Track your graphics card repair status online.",
  openGraph: {
    siteName: shopName,
    type: "website",
  },
  twitter: {
    card: "summary",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${orbitron.variable} ${rajdhani.variable} ${shareTechMono.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
