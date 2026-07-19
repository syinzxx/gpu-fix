import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addExpense, deleteExpense } from "@/app/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { Button, Input, Label, Select, Card, CardHeader, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { money, fmtDate, cn } from "@/lib/utils";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "RECEPTIONIST"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400_000);

  const [expenses, paymentsToday, expensesToday] = await Promise.all([
    db.expense.findMany({
      include: { createdBy: true },
      orderBy: { date: "desc" },
      take: 100,
    }),
    db.payment.findMany({
      where: { createdAt: { gte: startOfToday, lt: endOfToday } },
      select: { amount: true, method: true, kind: true },
    }),
    db.expense.findMany({
      where: { date: { gte: startOfToday, lt: endOfToday } },
      select: { amount: true },
    }),
  ]);

  // Net today's payments by method (refunds subtract)
  const byMethod = new Map<string, number>();
  let totalIn = 0;
  for (const p of paymentsToday) {
    const signed = p.kind === "REFUND" ? -p.amount : p.amount;
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + signed);
    totalIn += signed;
  }
  const totalOut = expensesToday.reduce((s, e) => s + e.amount, 0);
  const net = totalIn - totalOut;
  // Build the yyyy-mm-dd default from local date parts — toISOString() would
  // shift to UTC and show yesterday for timezones ahead of UTC.
  const todayStr = [
    startOfToday.getFullYear(),
    String(startOfToday.getMonth() + 1).padStart(2, "0"),
    String(startOfToday.getDate()).padStart(2, "0"),
  ].join("-");

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Expenses</h1>

      {/* Today's cash summary */}
      <Card className="p-5">
        <p className="silk-label text-slate-400">Today</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-slate-400">Payments in</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-emerald-600">{money(totalIn)}</p>
            {byMethod.size > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                {Array.from(byMethod.entries()).map(([m, amt]) => `${m} ${money(amt)}`).join(" · ")}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Expenses out</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-rose-600">{money(totalOut)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Net</p>
            <p className={cn("mt-1 font-display text-2xl font-bold tracking-tight", net >= 0 ? "text-slate-900" : "text-rose-600")}>
              {money(net)}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Expense list */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Expenses" />
            {expenses.length === 0 ? (
              <EmptyState message="No expenses recorded yet." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th><Th>Category</Th><Th>Amount</Th><Th>Note</Th><Th>Added by</Th><Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <Td>{fmtDate(e.date)}</Td>
                      <Td><Badge className="bg-slate-100 text-slate-600">{e.category}</Badge></Td>
                      <Td className="font-medium">{money(e.amount)}</Td>
                      <Td className="text-slate-500">{e.note ?? "—"}</Td>
                      <Td className="text-xs text-slate-500">{e.createdBy?.name ?? "—"}</Td>
                      <Td>
                        {session.user.role === "ADMIN" && (
                          <form action={deleteExpense}>
                            <input type="hidden" name="id" value={e.id} />
                            <Button size="sm" variant="ghost" type="submit" title="Delete">✕</Button>
                          </form>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        {/* Add expense */}
        <Card className="h-fit">
          <CardHeader title="Add expense" />
          <form action={addExpense} className="space-y-3 p-5">
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue="OTHER">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={todayStr} />
            </div>
            <div>
              <Label htmlFor="note">Note</Label>
              <Input id="note" name="note" placeholder="Optional" />
            </div>
            <Button type="submit" className="w-full">Add expense</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
