import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import GpuHero from "@/components/gpu-hero";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import WhatsAppButton from "@/components/whatsapp-button";
import { LocalBusinessJsonLd } from "@/components/local-business-jsonld";
import { getT } from "@/lib/locale";
import { getSettings } from "@/lib/settings";
import { normalizePhone, resolveWhatsappNumber, waMeLink } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t.metaHomeTitle,
    description: t.metaHomeDescription,
    openGraph: {
      title: t.metaHomeTitle,
      description: t.metaHomeDescription,
    },
  };
}

async function trackAction(formData: FormData) {
  "use server";
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  if (code) redirect(`/track/${encodeURIComponent(code)}`);
}

export default async function Home() {
  const [t, settings] = await Promise.all([getT(), getSettings()]);

  const services = [
    { icon: "🖥️", title: t.svcNoDisplayTitle, desc: t.svcNoDisplayDesc },
    { icon: "💾", title: t.svcVramTitle, desc: t.svcVramDesc },
    { icon: "🔩", title: t.svcReballingTitle, desc: t.svcReballingDesc },
    { icon: "🌀", title: t.svcThermalTitle, desc: t.svcThermalDesc },
    { icon: "🧩", title: t.svcVbiosTitle, desc: t.svcVbiosDesc },
    { icon: "💧", title: t.svcWaterTitle, desc: t.svcWaterDesc },
  ];

  const steps = [
    { n: 1, title: t.step1Title, desc: t.step1Desc },
    { n: 2, title: t.step2Title, desc: t.step2Desc },
    { n: 3, title: t.step3Title, desc: t.step3Desc },
    { n: 4, title: t.step4Title, desc: t.step4Desc },
    { n: 5, title: t.step5Title, desc: t.step5Desc, href: "#track" },
    { n: 6, title: t.step6Title, desc: t.step6Desc },
  ];

  const trustItems = [
    { icon: "🛡️", title: t.trustWarrantyTitle, desc: t.trustWarrantyDesc },
    { icon: "🧰", title: t.trustPartsTitle, desc: t.trustPartsDesc },
    { icon: "💬", title: t.trustUpdatesTitle, desc: t.trustUpdatesDesc },
  ];

  const whatsappNumber = resolveWhatsappNumber(settings.shopPhone);

  return (
    <div className="flex flex-1 flex-col bg-[#0b1120]">
      <LocalBusinessJsonLd />
      <SiteHeader />
      <main className="relative flex flex-1 flex-col justify-center overflow-hidden px-4 py-16 lg:px-10">
        {/* Ambient glow — light escaping a glass case */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 left-1/4 h-[360px] w-[520px] rounded-full bg-cyan-500/15 blur-[120px]"
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[2fr_3fr] lg:gap-4">
          <div className="order-2 mx-auto w-full max-w-md text-center lg:order-1 lg:text-start">
            <div
              aria-hidden
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xl shadow-lg shadow-violet-500/30 lg:mx-0"
            >
              ⚡
            </div>
            <p className="mt-5 text-sm font-semibold text-cyan-300/80">
              {settings.shopName}
            </p>
            <h1 className="mt-2 font-display text-5xl font-bold tracking-tight text-white">
              {t.heroTitleLine1}
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
                {t.heroTitleAccent}
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-slate-400 lg:mx-0">
              {t.heroSubtitle}
            </p>

            <form
              id="track"
              action={trackAction}
              className="mx-auto mt-9 flex max-w-sm gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 backdrop-blur lg:mx-0"
            >
              <label htmlFor="code" className="sr-only">
                {t.ticketCodeLabel}
              </label>
              <input
                id="code"
                name="code"
                required
                placeholder={t.ticketCodePlaceholder}
                autoComplete="off"
                className="w-full min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-center font-mono text-lg uppercase tracking-[0.15em] text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 cursor-pointer"
              >
                {t.trackBtn}
              </button>
            </form>

            <p className="mt-14 text-sm text-slate-500">
              {t.staffMemberPrompt}{" "}
              <Link
                href="/login"
                className="font-semibold text-slate-300 hover:text-white"
              >
                {t.signInArrow}
              </Link>
            </p>
          </div>

          <div className="order-1 h-[340px] w-full sm:h-[420px] lg:order-2 lg:h-[600px]">
            <GpuHero />
          </div>
        </div>

        {/* Services */}
        <section className="relative py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-10">
            <p className="silk-label text-cyan-300/80">{t.servicesKicker}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
              {t.servicesTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-slate-300">{t.servicesSubtitle}</p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10"
                >
                  <div
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20 text-xl ring-1 ring-white/10"
                  >
                    {s.icon}
                  </div>
                  <h3 className="mt-4 font-display font-bold tracking-tight text-white">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-300">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="relative py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-10">
            <p className="silk-label text-cyan-300/80">{t.howKicker}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
              {t.howTitle}
            </h2>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((step) => {
                const content = (
                  <>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 font-mono text-sm font-bold text-white">
                      {step.n}
                    </span>
                    <div className="mt-4">
                      <h3 className="font-display font-bold tracking-tight text-white">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-slate-300">{step.desc}</p>
                    </div>
                  </>
                );
                return step.href ? (
                  <a
                    key={step.n}
                    href={step.href}
                    className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={step.n}
                    className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Trust / warranty */}
        <section className="relative py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-10">
            <p className="silk-label text-cyan-300/80">{t.trustKicker}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
              {t.trustTitle}
            </h2>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trustItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10"
                >
                  <div
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20 text-xl ring-1 ring-white/10"
                  >
                    {item.icon}
                  </div>
                  <h3 className="mt-4 font-display font-bold tracking-tight text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-300">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="relative py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-10">
            <p className="silk-label text-cyan-300/80">{t.contactKicker}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
              {t.contactTitle}
            </h2>

            <div className="mt-10 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 sm:p-8">
              <dl className="grid gap-6 sm:grid-cols-3">
                {settings.shopAddress && (
                  <div>
                    <dt className="silk-label text-cyan-300/80">
                      {t.contactAddressLabel}
                    </dt>
                    <dd className="mt-1.5 text-slate-300">{settings.shopAddress}</dd>
                  </div>
                )}
                {settings.shopPhone && (
                  <div>
                    <dt className="silk-label text-cyan-300/80">
                      {t.contactPhoneLabel}
                    </dt>
                    <dd className="mt-1.5 text-slate-300">
                      <a
                        href={`tel:+${normalizePhone(settings.shopPhone)}`}
                        className="hover:text-white"
                      >
                        <span dir="ltr">{settings.shopPhone}</span>
                      </a>
                    </dd>
                  </div>
                )}
                {settings.shopHours && (
                  <div>
                    <dt className="silk-label text-cyan-300/80">
                      {t.contactHoursLabel}
                    </dt>
                    <dd className="mt-1.5 text-slate-300">{settings.shopHours}</dd>
                  </div>
                )}
              </dl>

              {whatsappNumber && (
                <a
                  href={waMeLink(whatsappNumber, t.whatsappPrefill)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                >
                  {t.contactWhatsappCta}
                </a>
              )}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </div>
  );
}
