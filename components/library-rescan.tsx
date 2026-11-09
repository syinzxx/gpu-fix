"use client";

import { useActionState } from "react";
import { rescanLibrary, type RescanState } from "@/app/actions/library";
import { Button } from "@/components/ui";
import type { Translations } from "@/lib/i18n";

export function RescanButton({ t }: { t: Translations }) {
  const [state, action, pending] = useActionState<RescanState, FormData>(rescanLibrary, {});
  return (
    <form action={action} className="space-y-3 p-5">
      <p className="text-sm text-slate-500">{t.libRescanDesc}</p>
      <Button type="submit" disabled={pending}>{pending ? t.libRescanning : t.libRescan}</Button>
      <p role="status" className={state.error ? "text-sm font-semibold text-rose-600" : "text-sm font-semibold text-emerald-700"}>
        {state.error
          ? t.libRescanFailed
          : state.summary
            ? `${t.libRescanDone} ${state.summary.newFiles} ${t.libRescanNew} · ${state.summary.missing} ${t.libRescanMissing} · ${state.summary.inbox} ${t.libRescanInbox}`
            : ""}
      </p>
      {state.pdfReading && state.pdfReading !== "none" && (
        <p className={state.pdfReading === "nexus-closed" ? "text-sm font-semibold text-amber-600" : "text-sm text-slate-600"}>
          {state.pdfsWaiting} {state.pdfReading === "started" ? t.libPdfStarted : state.pdfReading === "running" ? t.libPdfRunning : t.libPdfNexusClosed}
        </p>
      )}
    </form>
  );
}
