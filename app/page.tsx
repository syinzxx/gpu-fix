import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import GpuHero from "@/components/gpu-hero";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import WhatsAppButton from "@/components/whatsapp-button";
import { Icon } from "@/components/icons";
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
    { icon: "monitor" as const, title: t.svcNoDisplayTitle, desc: t.svcNoDisplayDesc },
    { icon: "chip" as const, title: t.svcVramTitle, desc: t.svcVramDesc },
    { icon: "core" as const, title: t.svcReballingTitle, desc: t.svcReballingDesc },
    { icon: "fan" as const, title: t.svcThermalTitle, desc: t.svcThermalDesc },
    { icon: "code" as const, title: t.svcVbiosTitle, desc: t.svcVbiosDesc },
    { icon: "droplet" as const, title: t.svcWaterTitle, desc: t.svcWaterDesc },
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
    { icon: "shield" as const, title: t.trustWarrantyTitle, desc: t.trustWarrantyDesc },
    { icon: "wrench" as const, title: t.trustPartsTitle, desc: t.trustPartsDesc },
    { icon: "chat" as const, title: t.trustUpdatesTitle, desc: t.trustUpdatesDesc },
  ];

  const whatsappNumber = resolveWhatsappNumber(settings);

  return (
    <div className="gr-night flex flex-1 flex-col">
      <LocalBusinessJsonLd />
      <SiteHeader />
      <main className="relative flex flex-1 flex-col justify-center overflow-hidden px-4 py-16 lg:px-10">
        {/* Circuit traces + scanlines (decorative, low contrast) */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[900px] w-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMin slice"
          fill="none"
        >
          <g stroke="#1565C0" strokeWidth="2" opacity="0.22" strokeLinejoin="round">
            <path d="M0 180H240L300 240H520L580 180H760" />
            <path d="M0 520H160L230 590H420" />
            <path d="M1440 120H1160L1100 180H900" />
            <path d="M1440 640H1220L1150 570H960" />
            <path d="M700 0V110L760 170V260" />
          </g>
          <g stroke="#29B6F6" strokeWidth="3" strokeLinecap="round" opacity="0.4">
            <path className="gr-trace-pulse" pathLength={1} style={{ ["--p" as string]: "7s", ["--d" as string]: "-1s" }} d="M0 180H240L300 240H520L580 180H760" />
            <path className="gr-trace-pulse" pathLength={1} style={{ ["--p" as string]: "6s", ["--d" as string]: "-3s" }} d="M0 520H160L230 590H420" />
            <path className="gr-trace-pulse" pathLength={1} style={{ ["--p" as string]: "8s", ["--d" as string]: "-5s" }} d="M1440 120H1160L1100 180H900" />
            <path className="gr-trace-pulse" pathLength={1} style={{ ["--p" as string]: "9s", ["--d" as string]: "-2s" }} d="M1440 640H1220L1150 570H960" />
            <path className="gr-trace-pulse" pathLength={1} style={{ ["--p" as string]: "7.5s", ["--d" as string]: "-4s" }} d="M700 0V110L760 170V260" />
          </g>
        </svg>
        <div aria-hidden className="gr-scanlines pointer-events-none absolute inset-0" />
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt=""
              width={72}
              height={72}
              className="mx-auto drop-shadow-[0_0_24px_rgba(41,182,246,0.5)] lg:mx-0"
            />
            <p className="silk-label mt-5 text-cyan-300">
              {settings.shopName}
            </p>
            <h1 className="mt-2 font-display text-4xl font-black text-white lg:text-5xl">
              {t.heroTitleLine1}
              <br />
              <span className="text-cyan-400 [text-shadow:0_0_28px_rgba(41,182,246,0.55)]">
                {t.heroTitleAccent}
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-slate-400 lg:mx-0">
              {t.heroSubtitle}
            </p>

            <form
              id="track"
              action={trackAction}
              className="mx-auto mt-9 flex max-w-sm gap-2 rounded-2xl bg-[#0B2E6B]/60 p-2 ring-[1.5px] ring-cyan-400/50 shadow-[0_0_28px_rgba(41,182,246,0.25)] backdrop-blur lg:mx-0"
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
                className="w-full min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-center font-mono text-lg uppercase tracking-[0.15em] text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 font-display text-xs font-extrabold tracking-[0.1em] text-white shadow-lg shadow-violet-600/30 transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 cursor-pointer"
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
            <p className="silk-label text-cyan-300">{t.servicesKicker}</p>
            <h2 className="mt-2 font-display text-3xl font-black text-white">
              {t.servicesTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-slate-300">{t.servicesSubtitle}</p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl bg-[#0B2E6B]/45 p-6 ring-[1.5px] ring-cyan-400/25"
                >
                  <div
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B2E6B] text-cyan-400 ring-1 ring-cyan-400/40"
                  >
                    <Icon name={s.icon} size={22} />
                  </div>
                  <h3 className="mt-4 font-display text-sm font-extrabold text-white">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] text-slate-300">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="relative py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-10">
            <p className="silk-label text-cyan-300">{t.howKicker}</p>
            <h2 className="mt-2 font-display text-3xl font-black text-white">
              {t.howTitle}
            </h2>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((step) => {
                const content = (
                  <>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 font-mono text-base text-white ring-2 ring-cyan-400/60">
                      {step.n}
                    </span>
                    <div className="mt-4">
                      <h3 className="font-display text-sm font-extrabold text-white">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-[15px] text-slate-300">{step.desc}</p>
                    </div>
                  </>
                );
                return step.href ? (
                  <a
                    key={step.n}
                    href={step.href}
                    className="rounded-2xl bg-[#0B2E6B]/45 p-6 ring-[1.5px] ring-cyan-400/25 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={step.n}
                    className="rounded-2xl bg-[#0B2E6B]/45 p-6 ring-[1.5px] ring-cyan-400/25"
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
            <p className="silk-label text-cyan-300">{t.trustKicker}</p>
            <h2 className="mt-2 font-display text-3xl font-black text-white">
              {t.trustTitle}
            </h2>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trustItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-[#0B2E6B]/45 p-6 ring-[1.5px] ring-cyan-400/25"
                >
                  <div
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B2E6B] text-cyan-400 ring-1 ring-cyan-400/40"
                  >
                    <Icon name={item.icon} size={22} />
                  </div>
                  <h3 className="mt-4 font-display text-sm font-extrabold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] text-slate-300">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="relative py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-10">
            <p className="silk-label text-cyan-300">{t.contactKicker}</p>
            <h2 className="mt-2 font-display text-3xl font-black text-white">
              {t.contactTitle}
            </h2>

            <div className="mt-10 rounded-2xl bg-[#0B2E6B]/45 p-6 ring-[1.5px] ring-cyan-400/25 sm:p-8">
              <dl className="grid gap-6 sm:grid-cols-3">
                {settings.shopAddress && (
                  <div>
                    <dt className="silk-label text-cyan-300">
                      {t.contactAddressLabel}
                    </dt>
                    <dd className="mt-1.5 text-slate-300">{settings.shopAddress}</dd>
                  </div>
                )}
                {settings.shopPhone && (
                  <div>
                    <dt className="silk-label text-cyan-300">
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
                    <dt className="silk-label text-cyan-300">
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
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 font-display text-xs font-extrabold tracking-[0.1em] text-white shadow-lg shadow-violet-600/30 transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
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
