import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateCustomer } from "@/app/actions/admin";
import { getT } from "@/lib/locale";
import { Button, Input, Label, Textarea, Card, CardHeader, Table, Th, Td, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { fmtDate } from "@/lib/utils";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [customer, t] = await Promise.all([
    db.customer.findUnique({
      where: { id },
      include: {
        tickets: {
          include: { assignedTo: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getT(),
  ]);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/customers" className="text-sm text-violet-700 hover:underline">
          ← {t.customers}
        </Link>
      </div>

      <div>
        <p className="silk-label text-violet-600">{t.customers.toLowerCase()}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{customer.name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {t.memberSince} {fmtDate(customer.createdAt)} · {customer.tickets.length} {t.tickets.toLowerCase()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Edit form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader title={t.contactDetails} />
            <form action={updateCustomer} className="space-y-4 p-5">
              <input type="hidden" name="id" value={customer.id} />
              <div>
                <Label htmlFor="name">{t.name}</Label>
                <Input id="name" name="name" required defaultValue={customer.name} />
              </div>
              <div>
                <Label htmlFor="phone">{t.phone}</Label>
                <Input id="phone" name="phone" required defaultValue={customer.phone} />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" name="whatsapp" defaultValue={customer.whatsapp ?? ""} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={customer.email ?? ""} />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} defaultValue={customer.notes ?? ""} />
              </div>
              <Button type="submit" variant="secondary" className="w-full">{t.saveChanges}</Button>
            </form>
          </Card>
        </div>

        {/* Ticket history */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title={t.repairHistory} />
            {customer.tickets.length === 0 ? (
              <EmptyState message={t.noTicketsYet} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t.code}</Th>
                    <Th>{t.device}</Th>
                    <Th>{t.status}</Th>
                    <Th>{t.assigned}</Th>
                    <Th>{t.date}</Th>
                  </tr>
                </thead>
                <tbody>
                  {customer.tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50">
                      <Td>
                        <Link href={`/dashboard/tickets/${ticket.id}`} className="font-mono font-semibold text-violet-700 hover:underline">
                          {ticket.code}
                        </Link>
                      </Td>
                      <Td>
                        <span className="font-medium text-slate-900">{ticket.brand} {ticket.model}</span>
                        <span className="block text-xs text-slate-400">{ticket.deviceType}</span>
                      </Td>
                      <Td><StatusBadge status={ticket.status} /></Td>
                      <Td>{ticket.assignedTo?.name ?? <span className="text-slate-400 text-xs">{t.unassigned}</span>}</Td>
                      <Td>{fmtDate(ticket.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
