import Link from "next/link";
import SocialLinks from "@/components/social-links";
import { LangToggle } from "@/components/lang-toggle";
import { getT, getLocale } from "@/lib/locale";
import { getSettings } from "@/lib/settings";

export default async function SiteHeader() {
  const [t, locale, settings] = await Promise.all([getT(), getLocale(), getSettings()]);

  return (
    <header className="relative z-10 border-b border-white/5">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-base shadow-lg shadow-violet-500/30" aria-hidden>
            ⚡
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            {settings.shopName}
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <SocialLinks />
          </div>
          <LangToggle current={locale} variant="dark" />
          <Link
            href="/login"
            className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t.navSignIn}
          </Link>
        </div>
      </div>
    </header>
  );
}
