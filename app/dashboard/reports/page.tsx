import { db } from "@/lib/db";
import { Card, CardHeader, Table, Th, Td, Badge } from "@/components/ui";
import { getT } from "@/lib/locale";
import { money, paymentsTotal, cn } from "@/lib/utils";

type TechRow = {
  id: string;
  name: string;
  openTickets: number;
  closedThisMonth: number;
  avgDaysToClose: number | null;
  avgRating: number | null;
};

export default async function ReportsPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [technicians, totalOpen, totalClosed, monthPayments, monthExpenses, ratingStats, t] = await Promise.all([
    db.user.findMany({
      where: { active: true, role: { in: ["TECHNICIAN", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.ticket.count({ where: { status: { not: "CLOSED" } } }),
    db.ticket.count({ where: { status: "CLOSED" } }),
    db.payment.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: { amount: true, kind: true },
    }),
    db.expense.findMany({
      where: { date: { gte: startOfMonth } },
      select: { amount: true },
    }),
    db.ticket.aggregate({
      where: { rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    getT(),
  ]);

  const monthIncome = paymentsTotal(monthPayments);
  const monthExpenseTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const monthNet = monthIncome - monthExpenseTotal;

  const rows: TechRow[] = await Promise.all(
    technicians.map(async (tech) => {
      const [open, closedThisMonth, closedAll] = await Promise.all([
        db.ticket.count({
          where: { assignedToId: tech.id, status: { not: "CLOSED" } },
        }),
        db.ticket.count({
          where: {
            assignedToId: tech.id,
            status: "CLOSED",
            closedAt: { gte: startOfMonth },
          },
        }),
        db.ticket.findMany({
          where: { assignedToId: tech.id, status: "CLOSED", closedAt: { not: null } },
          select: { createdAt: true, closedAt: true, rating: true },
        }),
      ]);

      const avgMs =
        closedAll.length > 0
          ? closedAll.reduce((sum, t) => sum + (t.closedAt!.getTime() - t.createdAt.getTime()), 0) /
            closedAll.length
          : null;
      const avgDays = avgMs !== null ? Math.round(avgMs / 86400_000) : null;

      const ratings = closedAll.map((t) => t.rating).filter((r): r is number => r != null);
      const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

      return {
        id: tech.id,
        name: tech.name,
        openTickets: open,
        closedThisMonth,
        avgDaysToClose: avgDays,
        avgRating,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="silk-label text-violet-600">{t.analytics}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.reportsTitle}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="p-5">
          <p className="silk-label text-slate-400">{t.totalOpen}</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">{totalOpen}</p>
        </Card>
        <Card className="p-5">
          <p className="silk-label text-slate-400">{t.totalClosed}</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">{totalClosed}</p>
        </Card>
        <Card className="p-5">
          <p className="silk-label text-slate-400">{t.closedThisMonth}</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">
            {rows.reduce((s, r) => s + r.closedThisMonth, 0)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="silk-label text-slate-400">{t.activeTechs}</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">{technicians.length}</p>
        </Card>
        <Card className="p-5">
          <p className="silk-label text-slate-400">{t.avgRating}</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">
            {ratingStats._count.rating > 0 ? `${ratingStats._avg.rating!.toFixed(1)} ★` : "—"}
          </p>
          {ratingStats._count.rating > 0 && (
            <p className="mt-0.5 text-xs text-slate-400">
              ({ratingStats._count.rating} {t.ratingsLabel})
            </p>
          )}
        </Card>
      </div>

      <div>
        <p className="silk-label text-violet-600">{t.cashFlow}</p>
        <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">{t.thisMonth}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="silk-label text-slate-400">{t.incomeThisMonth}</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-emerald-600">{money(monthIncome)}</p>
        </Card>
        <Card className="p-5">
          <p className="silk-label text-slate-400">{t.expensesThisMonth}</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-rose-600">{money(monthExpenseTotal)}</p>
        </Card>
        <Card className="p-5">
          <p className="silk-label text-slate-400">{t.netThisMonth}</p>
          <p className={cn("mt-1 font-display text-3xl font-bold tracking-tight", monthNet >= 0 ? "text-slate-900" : "text-rose-600")}>
            {money(monthNet)}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title={t.techWorkload} />
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">{t.noTechs}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t.name}</Th>
                <Th>{t.openTicketsCol}</Th>
                <Th>{t.closedThisMonth}</Th>
                <Th>{t.avgDaysToClose}</Th>
                <Th>{t.avgRating}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{r.name}</Td>
                  <Td>
                    {r.openTickets > 0 ? (
                      <Badge className="bg-violet-100 text-violet-700">{r.openTickets}</Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </Td>
                  <Td>
                    {r.closedThisMonth > 0 ? (
                      <Badge className="bg-emerald-100 text-emerald-700">{r.closedThisMonth}</Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </Td>
                  <Td>
                    {r.avgDaysToClose !== null ? (
                      <span className={r.avgDaysToClose > 7 ? "font-semibold text-amber-600" : "text-slate-900"}>
                        {r.avgDaysToClose}d
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {r.avgRating !== null ? (
                      <span className="text-slate-900">{r.avgRating.toFixed(1)} ★</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
