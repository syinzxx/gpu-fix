"use client";

import { Icon } from "@/components/icons";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 font-display text-xs font-extrabold tracking-[0.08em] text-white hover:bg-violet-600 print:hidden cursor-pointer"
    >
      <Icon name="printer" size={16} />
      Print / Save PDF
    </button>
  );
}
