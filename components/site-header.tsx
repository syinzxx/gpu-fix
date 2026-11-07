import Link from "next/link";
import SocialLinks from "@/components/social-links";
import { LangToggle } from "@/components/lang-toggle";
import { BrandMark } from "@/components/icons";
import { getT, getLocale } from "@/lib/locale";
import { getSettings } from "@/lib/settings";

export default async function SiteHeader() {
  const [t, locale, settings] = await Promise.all([getT(), getLocale(), getSettings()]);

  return (
    <header className="relative z-10 border-b border-cyan-400/15">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:px-10">
        <Link href="/" aria-label={settings.shopName}>
          <BrandMark name={settings.shopName} size={40} />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:block">
            <SocialLinks />
          </div>
          <LangToggle current={locale} variant="dark" />
          <Link
            href="/login"
            className="whitespace-nowrap rounded-xl bg-[#0B2E6B]/60 px-3 py-2 font-display sm:px-4 text-[11px] font-extrabold tracking-[0.1em] text-white ring-[1.5px] ring-cyan-400/45 transition-colors hover:bg-violet-600"
          >
            {t.navSignIn}
          </Link>
        </div>
      </div>
    </header>
  );
}
