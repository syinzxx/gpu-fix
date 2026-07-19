import Link from "next/link";
import SocialLinks from "@/components/social-links";
import { getT } from "@/lib/locale";
import { getSettings } from "@/lib/settings";

export default async function SiteFooter() {
  const [t, settings] = await Promise.all([getT(), getSettings()]);
  const shopName = settings.shopName;
  return (
    <footer className="relative z-10 border-t border-white/5">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-8 sm:flex-row sm:justify-between lg:px-10">
        <div className="text-center sm:text-start">
          <p className="font-display text-sm font-bold text-white">{shopName}</p>
          <p className="mt-1 text-xs text-slate-500">
            © {new Date().getFullYear()} {shopName}. {t.footerTagline}
          </p>
        </div>

        <SocialLinks />

        <nav className="flex items-center gap-5 text-sm text-slate-400">
          <Link href="/" className="transition-colors hover:text-white">
            {t.footerTrackRepair}
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            {t.footerStaffSignIn}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
