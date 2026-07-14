import Link from "next/link";
import { db } from "@/lib/db";
import { receivePurchaseOrder, cancelPurchaseOrder } from "@/app/actions/inventory";
import { Card, CardHeader, Table, Th, Td, EmptyState, Badge, Button } from "@/components/ui";
import { fmtDate, money } from "@/lib/utils";

const PO_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-400",
};

export default async function PurchaseOrdersPage() {
  const orders = await db.purchaseOrder.findMany({
    include: { supplier: true, items: { include: { part: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Purchase Orders</h1>
        <Link
          href="/dashboard/purchase-orders/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500"
        >
          + New Order
        </Link>
      </div>

      {orders.length === 0 ? (
        <Card><EmptyState message="No purchase orders yet. Create one to restock parts." /></Card>
      ) : (
        orders.map((po) => {
          const total = po.items.reduce((s, it) => s + it.quantity * it.unitCost, 0);
          return (
            <Card key={po.id}>
              <CardHeader
                title={`${po.number} — ${po.supplier.name}`}
                action={
                  <div className="flex items-center gap-2">
                    <Badge className={PO_COLORS[po.status]}>{po.status.toLowerCase()}</Badge>
                    {po.status === "PENDING" && (
                      <>
                        <form action={receivePurchaseOrder}>
                          <input type="hidden" name="id" value={po.id} />
                          <Button size="sm" type="submit">Receive → restock</Button>
                        </form>
                        <form action={cancelPurchaseOrder}>
                          <input type="hidden" name="id" value={po.id} />
                          <Button size="sm" variant="danger" type="submit">Cancel</Button>
                        </form>
                      </>
                    )}
                  </div>
                }
              />
              <Table>
                <thead>
                  <tr><Th>Part</Th><Th>Qty</Th><Th>Unit cost</Th><Th>Total</Th></tr>
                </thead>
                <tbody>
                  {po.items.map((it) => (
                    <tr key={it.id}>
                      <Td>{it.part.name} <span className="text-xs text-slate-400">({it.part.sku})</span></Td>
                      <Td>{it.quantity}</Td>
                      <Td>{money(it.unitCost)}</Td>
                      <Td>{money(it.quantity * it.unitCost)}</Td>
                    </tr>
                  ))}
                  <tr>
                    <Td colSpan={3} className="text-right font-medium">Order total</Td>
                    <Td className="font-bold">{money(total)}</Td>
                  </tr>
                </tbody>
              </Table>
              <p className="px-5 py-3 text-xs text-slate-400">
                Created {fmtDate(po.createdAt)}
                {po.receivedAt && ` · Received ${fmtDate(po.receivedAt)}`}
                {po.notes && ` · ${po.notes}`}
              </p>
            </Card>
          );
        })
      )}
    </div>
  );
}
