"use client";

import { useEffect, useTransition, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  STATUS_FLOW,
  STATUS_LABELS,
  type TicketStatus,
} from "@/lib/constants";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { etaUrgency, fmtDate, cn } from "@/lib/utils";
import { changeStatus, assignTicket, addNote, updateEta } from "@/app/actions/tickets";
import { uploadAttachment } from "@/app/actions/attachments";

export type SlideOverTicket = {
  id: string;
  code: string;
  status: string;
  priority: string;
  etaDate: Date | null;
  createdAt: Date;
  brand: string;
  model: string;
  deviceType: string;
  assignedToId: string | null;
  customer: { name: string; phone: string };
  assignedTo: { id: string; name: string } | null;
  attachments: { id: string; path: string; kind: string; isPublic: boolean }[];
};

export type Technician = { id: string; name: string };

export function TicketSlideOver({
  ticket,
  technicians,
  onClose,
}: {
  ticket: SlideOverTicket;
  technicians: Technician[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = useCallback(
    () => startTransition(() => { router.refresh(); }),
    [router, startTransition]
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [noteKey, setNoteKey] = useState(0);

  const nextStatuses = STATUS_FLOW[ticket.status as TicketStatus] ?? [];
  const urgency = etaUrgency(ticket.etaDate);
  const etaLabel =
    urgency === "overdue" ? "Overdue" :
    urgency === "today" ? "Due today" :
    urgency === "future" ? fmtDate(ticket.etaDate) : null;
  const etaColor =
    urgency === "overdue" ? "text-red-500" :
    urgency === "today" ? "text-amber-500" :
    urgency === "future" ? "text-emerald-500" : "";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket ${ticket.code}`}
        className="fixed inset-y-0 end-0 z-50 flex w-full max-w-sm flex-col overflow-y-auto bg-white shadow-xl"
      >
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg font-bold tracking-widest text-white">
                  {ticket.code}
                </span>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
              <p className="mt-1 truncate text-sm text-slate-400">
                {ticket.deviceType} · {ticket.brand} {ticket.model}
              </p>
              {etaLabel && (
                <p className={cn("mt-1 text-xs font-semibold", etaColor)}>
                  ● ETA: {etaLabel}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Customer strip */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {ticket.customer.name}
            </p>
            <p className="text-xs text-slate-500">{ticket.customer.phone}</p>
          </div>
          <Link
            href={`/dashboard/tickets/${ticket.id}`}
            className="ms-3 shrink-0 text-xs font-semibold text-violet-600 hover:underline"
          >
            Full ticket →
          </Link>
        </div>

        <div className="flex-1 divide-y divide-slate-100">
          {/* Move to */}
          {nextStatuses.length > 0 && (
            <section className="px-5 py-4">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                Move to
              </p>
              <div className="flex flex-col gap-2">
                {nextStatuses.map((next, i) => {
                  if (next === "QUOTE_SENT") {
                    return (
                      <Link
                        key={next}
                        href={`/dashboard/tickets/${ticket.id}`}
                        className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        → {STATUS_LABELS[next]}
                        <span className="ms-auto text-xs font-normal text-slate-400">
                          set quote on full page
                        </span>
                      </Link>
                    );
                  }
                  return (
                    <form
                      key={next}
                      action={async (fd) => {
                        try {
                          setActionError(null);
                          await changeStatus(fd);
                          onClose();
                          refresh();
                        } catch (e) {
                          setActionError(e instanceof Error ? e.message : "Failed to update status");
                        }
                      }}
                    >
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <input type="hidden" name="toStatus" value={next} />
                      <Button
                        type="submit"
                        variant={i === 0 ? "primary" : "secondary"}
                        className="w-full justify-start"
                        disabled={isPending}
                      >
                        → {STATUS_LABELS[next]}
                      </Button>
                    </form>
                  );
                })}
              </div>
            </section>
          )}

          {/* Assign */}
          <section className="px-5 py-4">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              Assigned technician
            </p>
            <form
              action={async (fd) => {
                try {
                  setActionError(null);
                  await assignTicket(fd);
                  refresh();
                } catch (e) {
                  setActionError(e instanceof Error ? e.message : "Failed to assign technician");
                }
              }}
              className="flex gap-2"
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Select
                name="assignedToId"
                defaultValue={ticket.assignedToId ?? ""}
                className="flex-1"
              >
                <option value="">— Unassigned</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>{tech.name}</option>
                ))}
              </Select>
              <Button type="submit" variant="secondary" disabled={isPending}>
                Save
              </Button>
            </form>
          </section>

          {/* ETA */}
          <section className="px-5 py-4">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              ETA
            </p>
            <form
              action={async (fd) => {
                try {
                  setActionError(null);
                  await updateEta(fd);
                  refresh();
                } catch (e) {
                  setActionError(e instanceof Error ? e.message : "Failed to update ETA");
                }
              }}
              className="flex gap-2"
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Input
                type="date"
                name="etaDate"
                defaultValue={
                  ticket.etaDate
                    ? new Date(ticket.etaDate).toISOString().slice(0, 10)
                    : ""
                }
                className="flex-1"
              />
              <Button type="submit" variant="secondary" disabled={isPending}>
                Save
              </Button>
            </form>
          </section>

          {/* Photos / Attachments */}
          <section className="px-5 py-4">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              Photos / Attachments
            </p>
            {ticket.attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {ticket.attachments.slice(0, 4).map((a) => (
                  <a
                    key={a.id}
                    href={a.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative h-12 w-12 overflow-hidden rounded-lg ring-1 ring-slate-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- staff-only thumbnail strip */}
                    <img src={a.path} alt="" className="h-full w-full object-cover" />
                    {a.isPublic && (
                      <span className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 text-center text-[9px] font-bold leading-tight text-white">
                        PUB
                      </span>
                    )}
                  </a>
                ))}
                {ticket.attachments.length > 4 && (
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-violet-600 ring-1 ring-slate-200 hover:bg-slate-200"
                  >
                    +{ticket.attachments.length - 4}
                  </Link>
                )}
              </div>
            )}
            <form action={async (fd) => {
                try {
                  setActionError(null);
                  await uploadAttachment(fd);
                  refresh();
                } catch (e) {
                  setActionError(e instanceof Error ? e.message : "Failed to upload attachment");
                }
              }}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div className="space-y-2">
                <input
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="block w-full text-xs text-slate-600 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                />
                <div className="flex items-center gap-2">
                  <Select name="kind" defaultValue="INTAKE" className="flex-1 text-xs">
                    <option value="INTAKE">INTAKE</option>
                    <option value="COMPLETION">COMPLETION</option>
                    <option value="OTHER">OTHER</option>
                  </Select>
                  <label className="flex items-center gap-1 whitespace-nowrap text-xs text-slate-500">
                    <input type="checkbox" name="isPublic" className="accent-violet-600" />
                    Public
                  </label>
                  <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
                    Upload
                  </Button>
                </div>
              </div>
            </form>
          </section>

          {/* Quick note */}
          <section className="px-5 py-4">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              Quick note
            </p>
            <form key={noteKey} action={async (fd) => {
                try {
                  setActionError(null);
                  await addNote(fd);
                  setNoteKey((k) => k + 1);
                  refresh();
                } catch (e) {
                  setActionError(e instanceof Error ? e.message : "Failed to post note");
                }
              }}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Textarea
                name="note"
                rows={2}
                placeholder="Add an internal note…"
                className="mb-2"
              />
              <div className="flex items-center justify-end gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" name="isPublic" className="accent-violet-600" />
                  Visible to customer
                </label>
                <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
                  Post
                </Button>
              </div>
            </form>
          </section>

          {actionError && (
            <div className="border-t border-red-100 bg-red-50 px-5 py-3">
              <p className="text-xs font-semibold text-red-600">{actionError}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
