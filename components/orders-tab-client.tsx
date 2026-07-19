"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Table, Th, Td, EmptyState, Badge, Button } from "@/components/ui";
import { fmtDate, money } from "@/lib/utils";
import { receivePurchaseOrder, cancelPurchaseOrder } from "@/app/actions/inventory";
import { PurchaseOrderSlideOver } from "@/components/purchase-order-slide-over";
import type { SupplierOption, PartOption } from "@/components/purchase-order-slide-over";

const PO_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-400",
};

type POItem = {
  id: string;
  quantity: number;
  unitCost: number;
  part: { name: string; sku: string };
};

export type PurchaseOrderData = {
  id: string;
  number: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  receivedAt: Date | null;
  supplier: { name: string };
  items: POItem[];
};

export function OrdersTabClient({
  orders,
  suppliers,
  parts,
}: {
  orders: PurchaseOrderData[];
  suppliers: SupplierOption[];
  parts: PartOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const refresh = useCallback(
    () => startTransition(() => { router.refresh(); }),
    [router, startTransition]
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setIsOpen(true)}>+ New order</Button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {actionError}
        </div>
      )}

      {orders.length === 0 ? (
        <Card>
          <EmptyState message="No purchase orders yet. Create one to restock parts." />
        </Card>
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
                        <form
                          action={async (fd) => {
                            try {
                              setActionError(null);
                              await receivePurchaseOrder(fd);
                              refresh();
                            } catch (e) {
                              setActionError(e instanceof Error ? e.message : "Failed to receive order");
                            }
                          }}
                        >
                          <input type="hidden" name="id" value={po.id} />
                          <Button size="sm" type="submit">Receive → restock</Button>
                        </form>
                        <form
                          action={async (fd) => {
                            try {
                              setActionError(null);
                              await cancelPurchaseOrder(fd);
                              refresh();
                            } catch (e) {
                              setActionError(e instanceof Error ? e.message : "Failed to cancel order");
                            }
                          }}
                        >
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
                  <tr>
                    <Th>Part</Th>
                    <Th>Qty</Th>
                    <Th>Unit cost</Th>
                    <Th>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((it) => (
                    <tr key={it.id}>
                      <Td>
                        {it.part.name}{" "}
                        <span className="text-xs text-slate-400">({it.part.sku})</span>
                      </Td>
                      <Td>{it.quantity}</Td>
                      <Td>{money(it.unitCost)}</Td>
                      <Td>{money(it.quantity * it.unitCost)}</Td>
                    </tr>
                  ))}
                  <tr>
                    <Td colSpan={3} className="text-right font-medium">
                      Order total
                    </Td>
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

      {isOpen && (
        <PurchaseOrderSlideOver
          suppliers={suppliers}
          parts={parts}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
