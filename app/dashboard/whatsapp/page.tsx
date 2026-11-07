import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/lib/locale";
import { Card, CardHeader, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  SENT:      "bg-emerald-100 text-emerald-700",
  DELIVERED: "bg-sky-100 text-sky-700",
  READ:      "bg-violet-100 text-violet-700",
  SKIPPED:   "bg-amber-100 text-amber-700",
  FAILED:    "bg-rose-100 text-rose-700",
};

const ALL_STATUSES = ["SENT", "DELIVERED", "READ", "FAILED", "SKIPPED"];

export default async function WhatsappLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = ALL_STATUSES.includes(status ?? "") ? status! : undefined;

  const [t, logs] = await Promise.all([
    getT(),
    db.whatsappLog.findMany({
      where: activeStatus ? { status: activeStatus } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        ticket: {
          select: {
            id: true,
            code: true,
            customer: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <p className="silk-label text-violet-600">comms</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.whatsappLogsTitle}</h1>
        <p className="mt-1 text-sm text-slate-400">{t.whatsappLogsDesc}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([undefined, ...ALL_STATUSES] as (string | undefined)[]).map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/dashboard/whatsapp?status=${s}` : "/dashboard/whatsapp"}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
              activeStatus === s || (!activeStatus && !s)
                ? "bg-violet-600 text-white ring-violet-600"
                : "bg-white text-slate-500 ring-slate-200 hover:ring-slate-300"
            }`}
          >
            {s ? s.toLowerCase() : t.filterAll}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title={`${logs.length} messages`} />
        {logs.length === 0 ? (
          <EmptyState message={t.noLogsYet} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ticket</Th>
                <Th>Customer</Th>
                <Th>{t.logTo}</Th>
                <Th>{t.status}</Th>
                <Th>{t.logBody}</Th>
                <Th>{t.logSentAt}</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <Td>
                    <Link
                      href={`/dashboard/tickets/${log.ticket.id}`}
                      className="font-mono text-xs font-semibold text-violet-700 hover:underline"
                    >
                      {log.ticket.code}
                    </Link>
                  </Td>
                  <Td className="text-sm">{log.ticket.customer.name}</Td>
                  <Td className="font-mono text-xs text-slate-500">{log.to}</Td>
                  <Td>
                    <Badge className={STATUS_COLORS[log.status] ?? "bg-slate-100 text-slate-500"}>
                      {log.status.toLowerCase()}
                    </Badge>
                    {log.error && (
                      <p className="mt-1 text-xs text-rose-500">{log.error}</p>
                    )}
                  </Td>
                  <Td className="max-w-xs truncate text-xs text-slate-500" title={log.body}>
                    {log.body.length > 80 ? log.body.slice(0, 80) + "…" : log.body}
                  </Td>
                  <Td className="text-xs text-slate-400">{fmtDateTime(log.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
