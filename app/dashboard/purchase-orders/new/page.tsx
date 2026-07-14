import { db } from "@/lib/db";
import { createPurchaseOrder } from "@/app/actions/inventory";
import { PoItemRows } from "@/components/po-items";
import { Button, Label, Select, Textarea, Card, CardHeader } from "@/components/ui";

export default async function NewPurchaseOrderPage() {
  const [suppliers, parts] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.part.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, costPrice: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">New Purchase Order</h1>

      <form action={createPurchaseOrder}>
        <Card>
          <CardHeader title="Order details" />
          <div className="space-y-4 p-5">
            <div>
              <Label htmlFor="supplierId">Supplier *</Label>
              <Select id="supplierId" name="supplierId" required defaultValue="">
                <option value="" disabled>Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>

            <PoItemRows parts={parts} />

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} placeholder="Optional" />
            </div>

            <Button type="submit" className="w-full">Create order</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
