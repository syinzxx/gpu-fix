import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { etaUrgency, cn } from "@/lib/utils";
import { TicketsClient } from "@/components/tickets-client";
import { getT } from "@/lib/locale";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  const showAll = status === "ALL";
  const showOpen = !status || status === "OPEN";
  const showPending = status === "PENDING";
  const showClosed = status === "CLOSED";

  const [tickets, technicians, t] = await Promise.all([
    db.ticket.findMany({
      where: {
        ...(showPending ? { staffStatus: "PENDING" } : {}),
        ...(showClosed ? { staffStatus: "CLOSED" } : {}),
        ...(showOpen ? { staffStatus: "OPEN" } : {}),
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

  const tableLabels = {
    code: t.code,
    device: t.device,
    customer: t.customerCard,
    status: t.status,
    type: "Type",
    assigned: t.assigned,
    eta: "ETA",
    received: t.received,
    closed: "Closed",
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
            showOpen
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          Open
        </Link>
        <Link
          href="/dashboard/tickets?status=PENDING"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            showPending
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          Pending
        </Link>
        <Link
          href="/dashboard/tickets?status=CLOSED"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            showClosed
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          Closed
        </Link>
        <Link
          href="/dashboard/tickets?status=ALL"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            showAll
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          All
        </Link>
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
