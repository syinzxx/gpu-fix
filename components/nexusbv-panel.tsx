"use client";

import { useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { Button, Card, CardHeader, Input, Label, Select } from "@/components/ui";
import type { PairFile } from "@/lib/library/pairing";
import type { Translations } from "@/lib/i18n";

type Result = { ok: boolean; code?: string; paired?: boolean };

type NexusBridge = {
  open: (files: { board: string | null; pdf: string | null }) => Promise<Result>;
  selectNet: (net: string) => Promise<Result>;
  selectComponent: (refdes: string) => Promise<Result>;
  selectPin: (refdes: string, pin: string) => Promise<Result>;
};

declare global {
  interface Window {
    nexusbv?: NexusBridge;
  }
}

const subscribe = () => () => {};

function errorText(code: string | undefined, t: Translations) {
  if (code === "NOT_INSTALLED") return t.libNexusNotInstalled;
  if (code === "NOT_RUNNING" || code === "TIMEOUT") return t.libNexusNotRunning;
  if (code === "NOT_FOUND") return t.libNexusNotFound;
  if (code === "BAD_FILE") return t.libNexusBadFile;
  if (code === "STILL_OPEN") return t.libNexusStillOpen;
  return t.libNexusFailed;
}

function FileChoice({
  id,
  label,
  files,
  value,
  onChange,
}: {
  id: string;
  label: string;
  files: PairFile[];
  value: string;
  onChange: (path: string) => void;
}) {
  if (files.length < 2) return null;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {files.map((file) => (
          <option key={file.path} value={file.path}>
            {file.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Appears only in the PC app, where the preload provides window.nexusbv. */
export function NexusBVPanel({
  boards,
  pdfs,
  defaultBoard,
  defaultPdf,
  t,
}: {
  boards: PairFile[];
  pdfs: PairFile[];
  defaultBoard: string | null;
  defaultPdf: string | null;
  t: Translations;
}) {
  const available = useSyncExternalStore(subscribe, () => !!window.nexusbv, () => false);
  const [board, setBoard] = useState(defaultBoard);
  const [pdf, setPdf] = useState(defaultPdf);
  const [net, setNet] = useState("");
  const [part, setPart] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, start] = useTransition();

  if (!available || (!board && !pdf)) return null;
  const bridge = window.nexusbv as NexusBridge;

  function run(action: () => Promise<Result>, success: (result: Result) => string) {
    setMessage(null);
    start(async () => {
      const result = await action();
      setMessage(result.ok ? { text: success(result), ok: true } : { text: errorText(result.code, t), ok: false });
    });
  }

  function jumpToNet(event: FormEvent) {
    event.preventDefault();
    const wanted = net.trim();
    if (wanted) run(() => bridge.selectNet(wanted), () => `${t.libNexusSelected} ${wanted}`);
  }

  function jumpToPart(event: FormEvent) {
    event.preventDefault();
    const refdes = part.trim();
    const pinNumber = pin.trim();
    if (!refdes) return;
    if (pinNumber) run(() => bridge.selectPin(refdes, pinNumber), () => `${t.libNexusSelected} ${refdes}.${pinNumber}`);
    else run(() => bridge.selectComponent(refdes), () => `${t.libNexusSelected} ${refdes}`);
  }

  const openLabel = board && pdf ? t.libOpenBoth : board ? t.libOpenBoard : t.libOpenPdf;
  const missing = !board ? t.libNoBoardview : !pdf ? t.libNoPdf : null;

  return (
    <Card>
      <CardHeader title="NexusBV" />
      <div className="space-y-3 p-5">
        <FileChoice id="nexus-board" label={t.libBoardview} files={boards} value={board ?? ""} onChange={setBoard} />
        <FileChoice id="nexus-pdf" label={t.libSchematic} files={pdfs} value={pdf ?? ""} onChange={setPdf} />
        <Button
          type="button"
          className="w-full"
          disabled={busy}
          onClick={() =>
            run(
              () => bridge.open({ board, pdf }),
              (result) => (result.paired ? t.libNexusPaired : t.libNexusOpened)
            )
          }
        >
          {openLabel}
        </Button>
        {missing && <p className="text-sm text-slate-500">{missing}</p>}

        {board && (
          <>
            <form onSubmit={jumpToNet} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor="nexus-net">{t.libJumpNet}</Label>
                <Input id="nexus-net" dir="ltr" value={net} placeholder="FBVDDQ" onChange={(event) => setNet(event.target.value)} />
              </div>
              <Button type="submit" variant="secondary" disabled={busy}>{t.libGo}</Button>
            </form>
            <form onSubmit={jumpToPart} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor="nexus-part">{t.libJumpPart}</Label>
                <Input id="nexus-part" dir="ltr" value={part} placeholder="U2000" onChange={(event) => setPart(event.target.value)} />
              </div>
              <div className="w-20">
                <Label htmlFor="nexus-pin">{t.libPin}</Label>
                <Input id="nexus-pin" dir="ltr" value={pin} onChange={(event) => setPin(event.target.value)} />
              </div>
              <Button type="submit" variant="secondary" disabled={busy}>{t.libGo}</Button>
            </form>
          </>
        )}

        <p
          role="status"
          className={
            busy
              ? "text-sm font-semibold text-slate-500"
              : message?.ok === false
                ? "text-sm font-semibold text-rose-600"
                : "text-sm font-semibold text-emerald-700"
          }
        >
          {busy ? t.libNexusWorking : message?.text}
        </p>
      </div>
    </Card>
  );
}
