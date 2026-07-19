"use client";

import { setLocale } from "@/app/actions/locale";

export function LangToggle({
  current,
  variant = "light",
}: {
  current: "en" | "ar";
  variant?: "light" | "dark";
}) {
  const variantClasses =
    variant === "dark"
      ? "text-slate-400 hover:bg-white/10 hover:text-white"
      : "text-slate-400 hover:bg-slate-100 hover:text-slate-700";

  return (
    <form action={setLocale} className="flex items-center gap-1">
      <input type="hidden" name="locale" value={current === "en" ? "ar" : "en"} />
      <button
        type="submit"
        className={`rounded-md px-2 py-1 text-xs font-bold tracking-wide focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${variantClasses}`}
        title={current === "en" ? "Switch to Arabic" : "Switch to English"}
      >
        {current === "en" ? "عربي" : "EN"}
      </button>
    </form>
  );
}
