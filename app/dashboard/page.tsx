import Link from "next/link";
import { db } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { Card, CardHeader, Table, Th, Td, EmptyState, Badge } from "@/components/ui";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { fmtDate } from "@/lib/utils";

export default async function DashboardPage() {
  const [activeCount, readyCount, quotesPending, lowStock, recentTickets] = await Promise.all([
    db.ticket.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
    db.ticket.count({ where: { status: "READY_FOR_PICKUP" } }),
    db.ticket.count({ where: { status: "QUOTE_SENT" } }),
    db.$queryRaw<{ cnt: bigint }[]>`SELECT COUNT(*) as cnt FROM Part WHERE quantity <= lowStockThreshold`,
    db.ticket.findMany({
      where: { status: { not: "CLOSED" } },
      include: { customer: true, assignedTo: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);

  const rank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  recentTickets.sort((a, b) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2));
  const queue = recentTickets.slice(0, 10);

  const lowStockCount = Number(lowStock[0]?.cnt ?? 0);

  const stats = [
    { label: "Devices in queue", value: activeCount, href: "/dashboard/tickets" },
    { label: "Ready for pickup", value: readyCount, href: "/dashboard/tickets?status=READY_FOR_PICKUP" },
    { label: "Quotes awaiting reply", value: quotesPending, href: "/dashboard/tickets?status=QUOTE_SENT" },
    { label: "Low-stock parts", value: lowStockCount, href: "/dashboard/inventory?filter=low", alert: lowStockCount > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="silk-label text-violet-600">workshop</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
        </div>
        <Link
          href="/dashboard/tickets/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500"
        >
          + New ticket
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 transition-colors hover:ring-violet-300">
              <p className="silk-label text-slate-400">{s.label}</p>
              <p className={`mt-1 font-display text-3xl font-bold tracking-tight tracking-tight ${s.alert ? "text-rose-600" : "text-slate-900"}`}>
                {s.value}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="Open tickets (queue order)" />
        {queue.length === 0 ? (
          <EmptyState message="No open tickets. Create one to get started." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Code</Th>
                <Th>Device</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Assigned</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {queue.map((t, i) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs text-slate-400">{String(i + 1).padStart(2, "0")}</Td>
                  <Td>
                    <Link href={`/dashboard/tickets/${t.id}`} className="font-mono font-semibold text-violet-700 hover:underline">
                      {t.code}
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {t.brand} {t.model}
                      <PriorityBadge priority={t.priority} />
                    </div>
                  </Td>
                  <Td>{t.customer.name}</Td>
                  <Td><StatusBadge status={t.status} /></Td>
                  <Td>{t.assignedTo?.name ?? <Badge className="bg-slate-100 text-slate-600">Unassigned</Badge>}</Td>
                  <Td>{fmtDate(t.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
