import { db } from "@/lib/db";
import { createSupplier } from "@/app/actions/inventory";
import { Button, Input, Label, Textarea, Card, CardHeader, Table, Th, Td, EmptyState } from "@/components/ui";

export default async function SuppliersPage() {
  const suppliers = await db.supplier.findMany({
    include: { _count: { select: { parts: true, purchaseOrders: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Suppliers</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="All suppliers" />
            {suppliers.length === 0 ? (
              <EmptyState message="No suppliers yet." />
            ) : (
              <Table>
                <thead>
                  <tr><Th>Name</Th><Th>Phone</Th><Th>Email</Th><Th>Parts</Th><Th>POs</Th></tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <Td className="font-medium">{s.name}</Td>
                      <Td>{s.phone ?? "—"}</Td>
                      <Td>{s.email ?? "—"}</Td>
                      <Td>{s._count.parts}</Td>
                      <Td>{s._count.purchaseOrders}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Add supplier" />
          <form action={createSupplier} className="space-y-3 p-5">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <Button type="submit" className="w-full">Add supplier</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
