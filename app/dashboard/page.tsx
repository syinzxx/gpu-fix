import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui";
import { etaUrgency } from "@/lib/utils";
import { QueueClient } from "@/components/queue-client";
import { getT } from "@/lib/locale";

export default async function DashboardPage() {
  const [activeCount, readyCount, quotesPending, lowStock, allOpen, technicians, t] =
    await Promise.all([
      db.ticket.count({ where: { staffStatus: { not: "CLOSED" } } }),
      db.ticket.count({ where: { customerStatus: "READY_FOR_PICKUP" } }),
      db.ticket.count({ where: { customerStatus: "WAITING_FOR_APPROVAL" } }),
      db.$queryRaw<{ cnt: bigint }[]>`SELECT COUNT(*) as cnt FROM Part WHERE quantity <= lowStockThreshold`,
      db.ticket.findMany({
        where: { staffStatus: { not: "CLOSED" } },
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

  const stats: {
    label: string;
    value: number;
    href: string;
    sub?: string | null;
    subAlert?: boolean;
    alert?: boolean;
  }[] = [
    {
      label: t.devicesInQueue,
      value: activeCount,
      href: "/dashboard/tickets",
      sub: overdueCount > 0 ? `${overdueCount} overdue` : null,
      subAlert: true,
    },
    { label: t.readyForPickup, value: readyCount, href: "/dashboard/tickets?status=READY_FOR_PICKUP" },
    { label: t.quotesAwaiting, value: quotesPending, href: "/dashboard/tickets?status=WAITING_FOR_QUOTE_APPROVAL" },
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
