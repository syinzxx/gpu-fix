import Link from "next/link";
import { redirect } from "next/navigation";

async function trackAction(formData: FormData) {
  "use server";
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  if (code) redirect(`/track/${encodeURIComponent(code)}`);
}

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#0b1120] px-4 py-16">
      {/* Ambient glow — light escaping a glass case */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 left-1/4 h-[360px] w-[520px] rounded-full bg-cyan-500/15 blur-[120px]"
      />

      <div className="relative w-full max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xl shadow-lg shadow-violet-500/30">
          ⚡
        </div>
        <p className="mt-5 text-sm font-semibold text-cyan-300/80">
          {process.env.SHOP_NAME ?? "GPU Fix Shop"}
        </p>
        <h1 className="mt-2 font-display text-5xl font-bold tracking-tight text-white">
          Your card is in
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
            good hands.
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-slate-400">
          Enter your ticket code to see exactly where your repair is — status,
          queue position, and cost, updated live.
        </p>

        <form
          action={trackAction}
          className="mx-auto mt-9 flex max-w-sm gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 backdrop-blur"
        >
          <label htmlFor="code" className="sr-only">
            Ticket code
          </label>
          <input
            id="code"
            name="code"
            required
            placeholder="GPU-XXXXX"
            autoComplete="off"
            className="w-full min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-center font-mono text-lg uppercase tracking-[0.15em] text-white placeholder:text-slate-600 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 cursor-pointer"
          >
            Track
          </button>
        </form>

        <p className="mt-14 text-sm text-slate-500">
          Staff member?{" "}
          <Link href="/login" className="font-semibold text-slate-300 hover:text-white">
            Sign in →
          </Link>
        </p>
      </div>
    </main>
  );
}
