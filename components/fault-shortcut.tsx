"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui";
import { readingsForStep, type FaultStep } from "@/lib/library/faults";
import { formatSpread, type ReadingRow } from "@/lib/library/measurements";
import type { Translations } from "@/lib/i18n";
import { nexusErrorText, sameFile } from "@/components/nexusbv-panel";

const subscribe = () => () => {};

type Outcome = { key: string; ok: boolean; text: string; net?: string };

function stepLabel(key: string, t: Translations) {
  const labels: Record<string, string> = {
    power12v: t.faultPower12v,
    pcieReset: t.faultPcieReset,
    pcieClock: t.faultPcieClock,
    gpuClock: t.faultGpuClock,
    gpuCore: t.faultGpuCore,
    memoryPower: t.faultMemoryPower,
    rail1v8: t.faultRail1v8,
    memoryRef: t.faultMemoryRef,
  };
  return labels[key] ?? key;
}

/** NO DISPLAY checks in bench order. Appears only in the PC app. */
export function FaultShortcut({
  steps,
  rows,
  boardPaths,
  t,
}: {
  steps: FaultStep[];
  rows: ReadingRow[];
  boardPaths: string[];
  t: Translations;
}) {
  const available = useSyncExternalStore(subscribe, () => !!window.nexusbv, () => false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, start] = useTransition();
  if (!available || !steps.length || !boardPaths.length) return null;

  function check(step: FaultStep) {
    setOutcome(null);
    start(async () => {
      const bridge = window.nexusbv;
      if (!bridge) return;
      const state = await bridge.getState();
      if (!state.ok) return setOutcome({ key: step.key, ok: false, text: nexusErrorText(state.code, t) });
      if (!boardPaths.some((file) => sameFile(file, state.board))) {
        return setOutcome({ key: step.key, ok: false, text: t.faultWrongBoard });
      }
      for (const net of step.nets) {
        const result = await bridge.selectNet(net);
        if (result.ok) return setOutcome({ key: step.key, ok: true, text: `${t.libNexusSelected} ${net}`, net });
        if (result.code !== "NOT_FOUND") {
          return setOutcome({ key: step.key, ok: false, text: nexusErrorText(result.code, t) });
        }
      }
      setOutcome({ key: step.key, ok: false, text: `${t.faultNoNet} ${step.nets.join(", ")}` });
    });
  }

  return (
    <Card>
      <CardHeader title={t.faultTitle} />
      <ol className="divide-y divide-slate-100">
        {steps.map((step, index) => {
          const saved = readingsForStep(step, rows);
          const result = outcome?.key === step.key ? outcome : null;
          return (
            <li key={step.key} className="px-5 py-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => check(step)}
                className="w-full cursor-pointer text-start text-sm font-bold text-violet-700 hover:underline disabled:opacity-50"
              >
                {index + 1}. {stepLabel(step.key, t)}
              </button>
              {result && (
                <p className={result.ok ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-rose-600"}>{result.text}</p>
              )}
              {saved.map((row) => (
                <p key={[row.target, row.mode, row.polarity].join("|")} className="text-xs text-slate-500" dir="ltr">
                  {row.target}: {t.libGood} {formatSpread(row.good, row.mode) || "-"} · {t.libFaulty} {formatSpread(row.faulty, row.mode) || "-"}
                </p>
              ))}
            </li>
          );
        })}
      </ol>
      <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">{t.faultHint}</p>
    </Card>
  );
}
