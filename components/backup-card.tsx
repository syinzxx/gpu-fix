"use client";

import { useActionState } from "react";
import { runBackup, type BackupState } from "@/app/actions/backup";
import { Button, Card, CardHeader } from "@/components/ui";
import type { Translations } from "@/lib/i18n";

type Listed = { dir: string; name: string; bytes: number; at: string };

const size = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

export function BackupCard({ dirs, recent, t }: { dirs: string[]; recent: Listed[]; t: Translations }) {
  const [state, action, pending] = useActionState<BackupState, FormData>(runBackup, {});
  const failed = state.copies?.filter((c) => !c.ok) ?? [];

  return (
    <Card>
      <CardHeader title={t.backupTitle} />
      <div className="space-y-3 p-5">
        <p className="text-sm text-slate-500">{t.backupDesc}</p>
        <ul className="space-y-1 text-sm">
          {dirs.map((dir, index) => {
            const newest = recent.find((r) => r.dir === dir);
            return (
              <li key={dir} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="block font-semibold break-all text-slate-800" dir="ltr">{dir}</span>
                <span className="text-xs text-slate-500">
                  {index === 0 ? t.backupMain : t.backupMirror} ·{" "}
                  {newest ? `${t.backupNewest} ${new Date(newest.at).toLocaleString()} (${size(newest.bytes)})` : t.backupNone}
                </span>
              </li>
            );
          })}
        </ul>
        <form action={action}>
          <Button type="submit" disabled={pending}>{pending ? t.backupRunning : t.backupNow}</Button>
        </form>
        <p role="status" className={state.error || failed.length ? "text-sm font-semibold text-rose-600" : "text-sm font-semibold text-emerald-700"}>
          {state.error
            ? `${t.backupFailed} ${state.error}`
            : state.name
              ? `${t.backupDone} ${state.name}${failed.length ? `. ${t.backupMirrorFailed} ${failed.map((f) => f.dir).join(", ")}` : ""}`
              : ""}
        </p>
      </div>
    </Card>
  );
}
