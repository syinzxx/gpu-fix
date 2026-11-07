import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Table, Th, Td, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { getT } from "@/lib/locale";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [customers, t] = await Promise.all([
    db.customer.findMany({
      where: q
        ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
        : {},
      include: {
        _count: { select: { tickets: true } },
        tickets: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getT(),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.customers}</h1>

      <form className="max-w-sm">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t.searchNamePhone}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </form>

      <Card>
        {customers.length === 0 ? (
          <EmptyState message={t.noCustomersFound} />
        ) : (
          <Table>
            <thead>
              <tr><Th>{t.name}</Th><Th>{t.phone}</Th><Th>{t.whatsapp}</Th><Th>{t.tickets}</Th><Th>{t.lastVisit}</Th></tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/dashboard/customers/${c.id}`} className="font-semibold text-violet-700 hover:underline">
                      {c.name}
                    </Link>
                  </Td>
                  <Td>{c.phone}</Td>
                  <Td>{c.whatsapp ?? "—"}</Td>
                  <Td>{c._count.tickets}</Td>
                  <Td>{fmtDate(c.tickets[0]?.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
