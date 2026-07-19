# Queue Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ETA urgency colouring and a slide-over action panel to both `/dashboard` and `/dashboard/tickets` so staff can change ticket status, reassign, update ETA, upload photos, and post notes without leaving the list view.

**Architecture:** Server components fetch all data and pass it to thin client wrappers (`QueueClient` / `TicketsClient`) that own the `selectedTicket` state. A shared `TicketSlideOver` client component renders the panel and calls existing server actions directly; it calls `router.refresh()` after each mutation to sync the table without a full navigation.

**Tech Stack:** Next.js 15 App Router, Prisma, server actions (`"use server"`), Tailwind CSS, TypeScript.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `lib/utils.ts` | Modify | Add `etaUrgency(date)` helper |
| `app/actions/tickets.ts` | Modify | Add `updateEta` action; fix missing revalidation in `assignTicket` |
| `app/actions/attachments.ts` | Modify | Add missing `/dashboard` revalidation to `uploadAttachment` |
| `components/ticket-slide-over.tsx` | **New** | Slide-over panel client component (all 7 sections) |
| `components/queue-client.tsx` | **New** | Client wrapper for the overview queue table |
| `components/tickets-client.tsx` | **New** | Client wrapper for the tickets list table |
| `app/dashboard/page.tsx` | Modify | Extended query, new sort, overdue banner, `QueueClient` |
| `app/dashboard/tickets/page.tsx` | Modify | Extended query, new sort, ETA column, `TicketsClient` |

---

## Task 1: Foundation — `etaUrgency` helper, `updateEta` action, revalidation fixes

**Files:**
- Modify: `lib/utils.ts`
- Modify: `app/actions/tickets.ts`
- Modify: `app/actions/attachments.ts`

- [ ] **Step 1: Add `etaUrgency` to `lib/utils.ts`**

Append after the `paymentsTotal` function:

```ts
export function etaUrgency(
  date: Date | null | undefined
): "overdue" | "today" | "future" | "none" {
  if (!date) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d < today) return "overdue";
  if (d.getTime() === today.getTime()) return "today";
  return "future";
}
```

- [ ] **Step 2: Add `updateEta` server action to `app/actions/tickets.ts`**

Append after the `updateTicketDetails` function (around line 256):

```ts
export async function updateEta(formData: FormData) {
  await requireUser();
  const ticketId = formData.get("ticketId") as string;
  const etaRaw = formData.get("etaDate") as string;

  await db.ticket.update({
    where: { id: ticketId },
    data: { etaDate: etaRaw ? new Date(etaRaw) : null },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 3: Fix missing `/dashboard` revalidation in `assignTicket`**

In `app/actions/tickets.ts`, find the `assignTicket` function (around line 213). After the existing `revalidatePath("/dashboard/tickets")` line, add:

```ts
  revalidatePath("/dashboard");
```

The two revalidatePath calls at the end of `assignTicket` should now be:
```ts
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
```

- [ ] **Step 4: Fix missing revalidation in `uploadAttachment`**

In `app/actions/attachments.ts`, find the two `revalidatePath` calls at the end of `uploadAttachment` (around line 57). Add two more:

```ts
  revalidatePath(`/dashboard/tickets/${ticket.id}`);
  revalidatePath(`/track/${ticket.code}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
```

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts app/actions/tickets.ts app/actions/attachments.ts
git commit -m "feat: add etaUrgency helper, updateEta action, fix revalidation paths"
```

---

## Task 2: `TicketSlideOver` client component

**Files:**
- Create: `components/ticket-slide-over.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  STATUS_FLOW,
  STATUS_LABELS,
  type TicketStatus,
} from "@/lib/constants";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Badge, Button, Input, Select, Textarea } from "@/components/ui";
import { etaUrgency, fmtDate, cn } from "@/lib/utils";
import { changeStatus, assignTicket, addNote, updateEta } from "@/app/actions/tickets";
import { uploadAttachment } from "@/app/actions/attachments";

export type SlideOverTicket = {
  id: string;
  code: string;
  status: string;
  priority: string;
  etaDate: Date | null;
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
    [router]
  );

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
                        await changeStatus(fd);
                        onClose();
                        refresh();
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
              action={async (fd) => { await assignTicket(fd); refresh(); }}
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
              action={async (fd) => { await updateEta(fd); refresh(); }}
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
                    onClick={(e) => e.stopPropagation()}
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
                    onClick={(e) => e.stopPropagation()}
                  >
                    +{ticket.attachments.length - 4}
                  </Link>
                )}
              </div>
            )}
            <form action={async (fd) => { await uploadAttachment(fd); refresh(); }}>
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
            <form action={async (fd) => { await addNote(fd); refresh(); }}>
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
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ticket-slide-over.tsx
git commit -m "feat: add TicketSlideOver client component"
```

---

## Task 3: `QueueClient` — client wrapper for overview dashboard

**Files:**
- Create: `components/queue-client.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { TicketSlideOver, type SlideOverTicket, type Technician } from "@/components/ticket-slide-over";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Badge, Table, Th, Td } from "@/components/ui";
import { etaUrgency, fmtDate, cn } from "@/lib/utils";

export function QueueClient({
  tickets,
  technicians,
  emptyMessage,
  labels,
}: {
  tickets: SlideOverTicket[];
  technicians: Technician[];
  emptyMessage: string;
  labels: { code: string; device: string; customer: string; status: string; assigned: string; eta: string; unassigned: string };
}) {
  const [selected, setSelected] = useState<SlideOverTicket | null>(null);
  const close = useCallback(() => setSelected(null), []);

  return (
    <>
      {tickets.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            ·
          </div>
          <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>{labels.code}</Th>
              <Th>{labels.device} · {labels.customer}</Th>
              <Th>{labels.status}</Th>
              <Th>{labels.assigned}</Th>
              <Th>{labels.eta}</Th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket, i) => {
              const urgency = etaUrgency(ticket.etaDate);
              const isSelected = selected?.id === ticket.id;
              return (
                <tr
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className={cn(
                    "cursor-pointer border-l-2 hover:bg-slate-50",
                    urgency === "overdue" && "border-l-red-400 bg-red-50/40 hover:bg-red-50/60",
                    urgency === "today" && "border-l-amber-400 bg-amber-50/30 hover:bg-amber-50/50",
                    urgency !== "overdue" && urgency !== "today" && "border-l-transparent",
                    isSelected && "ring-1 ring-inset ring-violet-200",
                  )}
                >
                  <Td className="font-mono text-xs text-slate-400">
                    {String(i + 1).padStart(2, "0")}
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/dashboard/tickets/${ticket.id}`}
                      className="font-mono font-semibold text-violet-700 hover:underline"
                    >
                      {ticket.code}
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {ticket.brand} {ticket.model}
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <span className="block text-xs text-slate-400">{ticket.customer.name}</span>
                  </Td>
                  <Td><StatusBadge status={ticket.status} /></Td>
                  <Td>
                    {ticket.assignedTo?.name ?? (
                      <Badge className="bg-slate-100 text-slate-600">{labels.unassigned}</Badge>
                    )}
                  </Td>
                  <Td><EtaCell date={ticket.etaDate} /></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {selected && (
        <TicketSlideOver
          ticket={selected}
          technicians={technicians}
          onClose={close}
        />
      )}
    </>
  );
}

function EtaCell({ date }: { date: Date | null }) {
  const urgency = etaUrgency(date);
  if (urgency === "none") return <span className="text-slate-300">—</span>;
  const label =
    urgency === "overdue" ? "Overdue" :
    urgency === "today" ? "Due today" :
    fmtDate(date);
  const color =
    urgency === "overdue" ? "text-red-600 font-semibold" :
    urgency === "today" ? "text-amber-600 font-semibold" :
    "text-emerald-600";
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", color)}>
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/queue-client.tsx
git commit -m "feat: add QueueClient wrapper for overview dashboard"
```

---

## Task 4: Update overview dashboard (`app/dashboard/page.tsx`)

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Replace the entire file contents**

```tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { etaUrgency } from "@/lib/utils";
import { QueueClient } from "@/components/queue-client";
import { getT } from "@/lib/locale";

export default async function DashboardPage() {
  const [activeCount, readyCount, quotesPending, lowStock, allOpen, technicians, t] =
    await Promise.all([
      db.ticket.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
      db.ticket.count({ where: { status: "READY_FOR_PICKUP" } }),
      db.ticket.count({ where: { status: "QUOTE_SENT" } }),
      db.$queryRaw<{ cnt: bigint }[]>`SELECT COUNT(*) as cnt FROM Part WHERE quantity <= lowStockThreshold`,
      db.ticket.findMany({
        where: { status: { not: "CLOSED" } },
        include: {
          customer: true,
          assignedTo: true,
          attachments: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.user.findMany({
        where: { active: true, role: { in: ["TECHNICIAN", "ADMIN"] } },
        orderBy: { name: "asc" },
      }),
      getT(),
    ]);

  const lowStockCount = Number(lowStock[0]?.cnt ?? 0);

  // Sort: priority → ETA urgency (overdue first) → received asc
  const priorityRank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  const etaRank = { overdue: 0, today: 1, future: 2, none: 3 } as const;

  allOpen.sort((a, b) => {
    const pDiff = (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;
    const eDiff = etaRank[etaUrgency(a.etaDate)] - etaRank[etaUrgency(b.etaDate)];
    if (eDiff !== 0) return eDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const queue = allOpen.slice(0, 20);
  const overdueTickets = allOpen.filter((tk) => etaUrgency(tk.etaDate) === "overdue");
  const overdueCount = overdueTickets.length;

  const stats = [
    {
      label: t.devicesInQueue,
      value: activeCount,
      href: "/dashboard/tickets",
      sub: overdueCount > 0 ? `${overdueCount} overdue` : null,
      subAlert: true,
    },
    { label: t.readyForPickup, value: readyCount, href: "/dashboard/tickets?status=READY_FOR_PICKUP" },
    { label: t.quotesAwaiting, value: quotesPending, href: "/dashboard/tickets?status=QUOTE_SENT" },
    {
      label: t.lowStockParts,
      value: lowStockCount,
      href: "/dashboard/inventory?filter=low",
      alert: lowStockCount > 0,
    },
  ];

  const queueLabels = {
    code: t.code,
    device: t.device,
    customer: t.customers,
    status: t.status,
    assigned: t.assigned,
    eta: "ETA",
    unassigned: t.unassigned,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="silk-label text-violet-600">workshop</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            {t.overview}
          </h1>
        </div>
        <Link
          href="/dashboard/tickets/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500"
        >
          {t.newTicket}
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 transition-colors hover:ring-violet-300">
              <p className="silk-label text-slate-400">{s.label}</p>
              <p
                className={`mt-1 font-display text-3xl font-bold tracking-tight ${
                  s.alert ? "text-rose-600" : "text-slate-900"
                }`}
              >
                {s.value}
              </p>
              {s.sub && (
                <p className={`mt-0.5 text-xs font-semibold ${s.subAlert ? "text-red-500" : "text-slate-400"}`}>
                  {s.sub}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>

      {/* Overdue alert banner */}
      {overdueCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-base">🔴</span>
            <div>
              <p className="text-sm font-semibold text-red-700">
                {overdueCount} ticket{overdueCount > 1 ? "s are" : " is"} overdue
              </p>
              <p className="text-xs text-red-400">
                {overdueTickets
                  .slice(0, 3)
                  .map((tk) => tk.code)
                  .join(" · ")}
                {overdueCount > 3 && ` · +${overdueCount - 3} more`}
                {" — click any row to take action"}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/tickets"
            className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
          >
            View all →
          </Link>
        </div>
      )}

      {/* Queue table */}
      <Card>
        <CardHeader title={t.openTickets} />
        <QueueClient
          tickets={queue}
          technicians={technicians}
          emptyMessage={t.noTickets}
          labels={queueLabels}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify the `t` object has the keys used**

The translation object `t` must have: `devicesInQueue`, `readyForPickup`, `quotesAwaiting`, `lowStockParts`, `overview`, `newTicket`, `openTickets`, `noTickets`, `code`, `device`, `customers`, `status`, `assigned`, `unassigned`. These all existed in the original file — no new keys needed.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: update overview dashboard with ETA urgency, overdue banner, slide-over"
```

---

## Task 5: `TicketsClient` — client wrapper for tickets list

**Files:**
- Create: `components/tickets-client.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { TicketSlideOver, type SlideOverTicket, type Technician } from "@/components/ticket-slide-over";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Badge, Table, Th, Td } from "@/components/ui";
import { etaUrgency, fmtDate, cn } from "@/lib/utils";

export function TicketsClient({
  tickets,
  technicians,
  emptyMessage,
  labels,
}: {
  tickets: SlideOverTicket[];
  technicians: Technician[];
  emptyMessage: string;
  labels: {
    code: string;
    device: string;
    customer: string;
    status: string;
    assigned: string;
    eta: string;
    received: string;
    unassigned: string;
  };
}) {
  const [selected, setSelected] = useState<SlideOverTicket | null>(null);
  const close = useCallback(() => setSelected(null), []);

  return (
    <>
      {tickets.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            ·
          </div>
          <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{labels.code}</Th>
              <Th>{labels.device} · {labels.customer}</Th>
              <Th>{labels.status}</Th>
              <Th>{labels.assigned}</Th>
              <Th>{labels.eta}</Th>
              <Th>{labels.received}</Th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => {
              const urgency = etaUrgency(ticket.etaDate);
              const isSelected = selected?.id === ticket.id;
              return (
                <tr
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className={cn(
                    "cursor-pointer border-l-2 hover:bg-slate-50",
                    urgency === "overdue" && "border-l-red-400 bg-red-50/40 hover:bg-red-50/60",
                    urgency === "today" && "border-l-amber-400 bg-amber-50/30 hover:bg-amber-50/50",
                    urgency !== "overdue" && urgency !== "today" && "border-l-transparent",
                    isSelected && "ring-1 ring-inset ring-violet-200",
                  )}
                >
                  <Td onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/dashboard/tickets/${ticket.id}`}
                      className="font-mono font-semibold text-violet-700 hover:underline"
                    >
                      {ticket.code}
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {ticket.brand} {ticket.model}
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <span className="block text-xs text-slate-400">
                      {ticket.customer.name}
                      <span className="ms-1 text-slate-300">{ticket.customer.phone}</span>
                    </span>
                  </Td>
                  <Td><StatusBadge status={ticket.status} /></Td>
                  <Td>
                    {ticket.assignedTo?.name ?? (
                      <Badge className="bg-slate-100 text-slate-600">{labels.unassigned}</Badge>
                    )}
                  </Td>
                  <Td><EtaCell date={ticket.etaDate} /></Td>
                  <Td className="text-xs text-slate-400">
                    {fmtDate((ticket as unknown as { createdAt: Date }).createdAt)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {selected && (
        <TicketSlideOver
          ticket={selected}
          technicians={technicians}
          onClose={close}
        />
      )}
    </>
  );
}

function EtaCell({ date }: { date: Date | null }) {
  const urgency = etaUrgency(date);
  if (urgency === "none") return <span className="text-slate-300">—</span>;
  const label =
    urgency === "overdue" ? "Overdue" :
    urgency === "today" ? "Due today" :
    fmtDate(date);
  const color =
    urgency === "overdue" ? "text-red-600 font-semibold" :
    urgency === "today" ? "text-amber-600 font-semibold" :
    "text-emerald-600";
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", color)}>
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}
```

> **Note on `createdAt`:** `SlideOverTicket` doesn't include `createdAt` — for the received column we need it. Either extend `SlideOverTicket` to add `createdAt: Date` or cast as above. Prefer extending the type: add `createdAt: Date` to `SlideOverTicket` in `components/ticket-slide-over.tsx` and pass it from the query. The cast above is the minimal path — fix the type if TypeScript errors arise.

- [ ] **Step 2: Extend `SlideOverTicket` to include `createdAt`**

In `components/ticket-slide-over.tsx`, add `createdAt: Date` to the `SlideOverTicket` type:

```ts
export type SlideOverTicket = {
  id: string;
  code: string;
  status: string;
  priority: string;
  etaDate: Date | null;
  createdAt: Date;           // ← add this line
  brand: string;
  model: string;
  deviceType: string;
  assignedToId: string | null;
  customer: { name: string; phone: string };
  assignedTo: { id: string; name: string } | null;
  attachments: { id: string; path: string; kind: string; isPublic: boolean }[];
};
```

Then update `components/tickets-client.tsx` to use `ticket.createdAt` directly (remove the cast):

```tsx
<Td className="text-xs text-slate-400">
  {fmtDate(ticket.createdAt)}
</Td>
```

- [ ] **Step 3: Commit**

```bash
git add components/tickets-client.tsx components/ticket-slide-over.tsx
git commit -m "feat: add TicketsClient wrapper for tickets list"
```

---

## Task 6: Update tickets list (`app/dashboard/tickets/page.tsx`)

**Files:**
- Modify: `app/dashboard/tickets/page.tsx`

- [ ] **Step 1: Replace the entire file contents**

```tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { STATUSES, statusLabelsFor, type TicketStatus } from "@/lib/constants";
import { Card } from "@/components/ui";
import { etaUrgency, cn } from "@/lib/utils";
import { TicketsClient } from "@/components/tickets-client";
import { getLocale, getT } from "@/lib/locale";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  const [tickets, technicians, locale, t] = await Promise.all([
    db.ticket.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q } },
                { brand: { contains: q } },
                { model: { contains: q } },
                { customer: { name: { contains: q } } },
                { customer: { phone: { contains: q } } },
              ],
            }
          : {}),
      },
      include: {
        customer: true,
        assignedTo: true,
        attachments: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    db.user.findMany({
      where: { active: true, role: { in: ["TECHNICIAN", "ADMIN"] } },
      orderBy: { name: "asc" },
    }),
    getLocale(),
    getT(),
  ]);

  // Sort in-memory: priority → ETA urgency → received asc
  const priorityRank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  const etaRank = { overdue: 0, today: 1, future: 2, none: 3 } as const;

  tickets.sort((a, b) => {
    const pDiff = (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;
    const eDiff = etaRank[etaUrgency(a.etaDate)] - etaRank[etaUrgency(b.etaDate)];
    if (eDiff !== 0) return eDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const statusLabels = statusLabelsFor(locale);

  const tableLabels = {
    code: t.code,
    device: t.device,
    customer: t.customerCard,
    status: t.status,
    assigned: t.assigned,
    eta: "ETA",
    received: t.received,
    unassigned: t.unassigned,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          {t.tickets}
        </h1>
        <Link
          href="/dashboard/tickets/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500"
        >
          {t.newTicket}
        </Link>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/tickets"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            !status
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          {t.all}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/dashboard/tickets?status=${s}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              status === s
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            {statusLabels[s as TicketStatus]}
          </Link>
        ))}
      </div>

      {/* Search */}
      <form className="max-w-sm">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t.ticketsSearchPlaceholder}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
        {status && <input type="hidden" name="status" value={status} />}
      </form>

      <Card>
        <TicketsClient
          tickets={tickets}
          technicians={technicians}
          emptyMessage={t.noTicketsMatch}
          labels={tableLabels}
        />
      </Card>
    </div>
  );
}
```

> **Note on translation keys:** The code above uses `t.status` and `t.received`. Check `lib/i18n.ts` to confirm these keys exist. If `t.status` is missing (the original page didn't use it as a standalone key), use a fallback string `"Status"` or add the key to `lib/i18n.ts`.

- [ ] **Step 2: Check translation keys in `lib/i18n.ts`**

Run a quick check:

```bash
grep -n '"status"\|"received"\|"unassigned"' lib/i18n.ts
```

If any key is missing, add it to the translations object in `lib/i18n.ts` following the existing pattern. The original tickets page used `t.status` — if it wasn't there before, the column header was hardcoded. Just add it.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/tickets/page.tsx
git commit -m "feat: update tickets list with ETA column, new sort, slide-over"
```

---

## Task 7: Check i18n keys and run the app

**Files:**
- Possibly modify: `lib/i18n.ts`

- [ ] **Step 1: Read `lib/i18n.ts` and verify required keys exist**

Open `lib/i18n.ts` and confirm all of these keys exist in the English translations object:
`status`, `received`, `unassigned`, `devicesInQueue`, `readyForPickup`, `quotesAwaiting`, `lowStockParts`, `overview`, `newTicket`, `openTickets`, `noTickets`, `code`, `device`, `customers`, `assigned`, `tickets`, `all`, `ticketsSearchPlaceholder`, `noTicketsMatch`, `customerCard`.

For any missing key, add it with an appropriate English value following the existing pattern in the file.

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors. Common issues:
- `SlideOverTicket.createdAt` missing from a query — ensure all `findMany` queries include the `createdAt` field (Prisma includes it by default).
- `t.status` or similar key not on the type — add it to `lib/i18n.ts`.

- [ ] **Step 3: Start dev server and manually test**

```bash
npm run dev
```

Test checklist:
- [ ] `/dashboard` loads without errors
- [ ] Overdue banner appears if any ticket has a past ETA date (set one manually in DB to test)
- [ ] Overdue sub-count appears below the "Devices in Queue" stat
- [ ] Clicking a queue row opens the slide-over
- [ ] Slide-over header shows code, status badge, priority badge, ETA label
- [ ] "Full ticket →" link navigates to the detail page
- [ ] "Move to" buttons appear (only valid next statuses)
- [ ] QUOTE_SENT status shows the "set quote on full page" link instead of a button
- [ ] Assign dropdown saves and the row updates (router.refresh)
- [ ] ETA save works and ETA column updates
- [ ] Photo upload works — thumbnail appears in slide-over after refresh
- [ ] Quick note posts without error
- [ ] Esc key closes the slide-over
- [ ] Clicking backdrop closes the slide-over
- [ ] `/dashboard/tickets` loads with ETA column
- [ ] Row click opens same slide-over on tickets page
- [ ] Status filter pills still work
- [ ] Search still works
- [ ] Overdue rows have red left border on both pages
- [ ] Due-today rows have amber left border

- [ ] **Step 4: Final commit**

```bash
git add lib/i18n.ts  # only if changed
git commit -m "feat: queue dashboard redesign complete — ETA urgency, slide-over panel, unified sort"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - ETA urgency 4-state system → `etaUrgency()` in Task 1, `EtaCell` in Tasks 3 & 5
  - Sort order priority → ETA urgency → received asc → Tasks 4 & 6
  - Overview queue cap 20 → Task 4
  - Overdue alert banner → Task 4
  - Overdue sub-count on stat card → Task 4
  - `TicketSlideOver` all 7 sections → Task 2
  - QUOTE_SENT special-case link → Task 2
  - Row border colouring → Tasks 3 & 5
  - `QueueClient` → Task 3
  - `TicketsClient` → Task 5
  - `updateEta` action → Task 1
  - Revalidation fixes → Task 1
  - `attachments` added to both list queries → Tasks 4 & 6
  - Technician list fetched once at page load → Tasks 4 & 6

- [x] **Type consistency:** `SlideOverTicket` defined once in `ticket-slide-over.tsx`, imported by both client wrappers. `createdAt` added in Task 5 step 2.

- [x] **No placeholders:** All code blocks are complete and runnable.
