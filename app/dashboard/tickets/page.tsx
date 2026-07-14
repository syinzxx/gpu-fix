import Link from "next/link";
import { db } from "@/lib/db";
import { STATUSES, STATUS_LABELS, type TicketStatus } from "@/lib/constants";
import { Card, Table, Th, Td, EmptyState, Badge } from "@/components/ui";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { fmtDate, cn } from "@/lib/utils";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  const tickets = await db.ticket.findMany({
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
    include: { customer: true, assignedTo: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Tickets</h1>
        <Link
          href="/dashboard/tickets/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500"
        >
          + New Ticket
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/tickets"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            !status ? "bg-slate-900 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/dashboard/tickets?status=${s}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              status === s ? "bg-slate-900 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            {STATUS_LABELS[s as TicketStatus]}
          </Link>
        ))}
      </div>

      <form className="max-w-sm">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search code, device, customer, phone…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
        {status && <input type="hidden" name="status" value={status} />}
      </form>

      <Card>
        {tickets.length === 0 ? (
          <EmptyState message="No tickets match." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Device</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Assigned</Th>
                <Th>ETA</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
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
                  <Td>
                    {t.customer.name}
                    <span className="block text-xs text-slate-400">{t.customer.phone}</span>
                  </Td>
                  <Td><StatusBadge status={t.status} /></Td>
                  <Td>{t.assignedTo?.name ?? <Badge className="bg-slate-100 text-slate-600">Unassigned</Badge>}</Td>
                  <Td>{fmtDate(t.etaDate)}</Td>
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
