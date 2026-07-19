import Link from "next/link";
import { db } from "@/lib/db";
import { adjustStock, createSupplier } from "@/app/actions/inventory";
import { PART_CATEGORIES } from "@/lib/constants";
import {
  Card,
  CardHeader,
  Table,
  Th,
  Td,
  EmptyState,
  Badge,
  Button,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { money, cn } from "@/lib/utils";
import { getT } from "@/lib/locale";
import { OrdersTabClient } from "@/components/orders-tab-client";
import type { PurchaseOrderData } from "@/components/orders-tab-client";

const TABS = [
  { key: "parts", label: "Parts" },
  { key: "orders", label: "Purchase Orders" },
  { key: "suppliers", label: "Suppliers" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string; category?: string; q?: string }>;
}) {
  const { tab: rawTab = "parts", filter, category, q } = await searchParams;
  const tab: Tab = (["parts", "orders", "suppliers"].includes(rawTab) ? rawTab : "parts") as Tab;

  const [allParts, suppliers, rawOrders, t] = await Promise.all([
    db.part.findMany({
      include: { supplier: true },
      orderBy: { name: "asc" },
    }),
    db.supplier.findMany({
      include: { _count: { select: { parts: true, purchaseOrders: true } } },
      orderBy: { name: "asc" },
    }),
    db.purchaseOrder.findMany({
      include: { supplier: true, items: { include: { part: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getT(),
  ]);

  // Parts tab: apply filters in memory (allParts already fetched for slide-over)
  const filtered = allParts.filter((p) => {
    if (category && p.category !== category) return false;
    if (q && !p.sku.includes(q) && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const shown = filter === "low" ? filtered.filter((p) => p.quantity <= p.lowStockThreshold) : filtered;
  const lowCount = allParts.filter((p) => p.quantity <= p.lowStockThreshold).length;
  const stockValue = allParts.reduce((s, p) => s + p.quantity * p.costPrice, 0);

  // Minimal data for slide-over props
  const partOptions = allParts.map(({ id, name, sku, costPrice }) => ({ id, name, sku, costPrice }));
  const supplierOptions = suppliers.map(({ id, name }) => ({ id, name }));

  // Shape orders to match PurchaseOrderData
  const orders: PurchaseOrderData[] = rawOrders.map((po) => ({
    id: po.id,
    number: po.number,
    status: po.status,
    notes: po.notes,
    createdAt: po.createdAt,
    receivedAt: po.receivedAt,
    supplier: { name: po.supplier.name },
    items: po.items.map((it) => ({
      id: it.id,
      quantity: it.quantity,
      unitCost: it.unitCost,
      part: { name: it.part.name, sku: it.part.sku },
    })),
  }));

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          {t.inventory}
        </h1>
        {tab === "parts" && (
          <Link
            href="/dashboard/inventory/new"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500"
          >
            {t.newPart}
          </Link>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/dashboard/inventory?tab=${key}`}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors",
              tab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── Parts tab ── */}
      {tab === "parts" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="silk-label text-slate-400">{t.distinctParts}</p>
              <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">
                {allParts.length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="silk-label text-slate-400">{t.lowStock}</p>
              <p
                className={cn(
                  "mt-1 font-display text-3xl font-bold tracking-tight",
                  lowCount > 0 ? "text-rose-600" : "text-slate-900"
                )}
              >
                {lowCount}
              </p>
            </Card>
            <Card className="p-4">
              <p className="silk-label text-slate-400">{t.stockValueCost}</p>
              <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">
                {money(stockValue)}
              </p>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/inventory?tab=parts"
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                !filter && !category
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 ring-1 ring-slate-200"
              )}
            >
              {t.all}
            </Link>
            <Link
              href="/dashboard/inventory?tab=parts&filter=low"
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                filter === "low"
                  ? "bg-rose-600 text-white"
                  : "bg-white text-slate-500 ring-1 ring-slate-200"
              )}
            >
              {t.lowStock}
            </Link>
            {PART_CATEGORIES.map((c) => (
              <Link
                key={c}
                href={`/dashboard/inventory?tab=parts&category=${c}`}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  category === c
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-500 ring-1 ring-slate-200"
                )}
              >
                {c}
              </Link>
            ))}
          </div>

          <form className="max-w-sm">
            <input type="hidden" name="tab" value="parts" />
            {category && <input type="hidden" name="category" value={category} />}
            {filter && <input type="hidden" name="filter" value={filter} />}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder={t.partsSearchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </form>

          <Card>
            {shown.length === 0 ? (
              <EmptyState message={t.noPartsFound} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t.sku}</Th>
                    <Th>{t.part}</Th>
                    <Th>{t.category}</Th>
                    <Th>{t.stock}</Th>
                    <Th>{t.cost}</Th>
                    <Th>{t.sell}</Th>
                    <Th>{t.supplier}</Th>
                    <Th>{t.adjust}</Th>
                    <Th>{t.label}</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const low = p.quantity <= p.lowStockThreshold;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <Td className="font-mono text-xs">{p.sku}</Td>
                        <Td>
                          <Link
                            href={`/dashboard/inventory/${p.id}`}
                            className="font-semibold text-violet-700 hover:underline"
                          >
                            {p.name}
                          </Link>
                        </Td>
                        <Td>
                          <Badge className="bg-slate-100 text-slate-600">{p.category}</Badge>
                        </Td>
                        <Td>
                          <span className={cn("font-bold", low && "text-rose-600")}>
                            {p.quantity}
                          </span>
                          {low && (
                            <Badge className="ml-2 bg-rose-100 text-rose-700">{t.low}</Badge>
                          )}
                        </Td>
                        <Td>{money(p.costPrice)}</Td>
                        <Td>{money(p.sellPrice)}</Td>
                        <Td className="text-xs text-slate-500">{p.supplier?.name ?? "—"}</Td>
                        <Td>
                          <div className="flex gap-1">
                            <form action={adjustStock}>
                              <input type="hidden" name="partId" value={p.id} />
                              <input type="hidden" name="delta" value="-1" />
                              <Button
                                size="sm"
                                variant="secondary"
                                type="submit"
                                disabled={p.quantity === 0}
                              >
                                −
                              </Button>
                            </form>
                            <form action={adjustStock}>
                              <input type="hidden" name="partId" value={p.id} />
                              <input type="hidden" name="delta" value="1" />
                              <Button size="sm" variant="secondary" type="submit">
                                +
                              </Button>
                            </form>
                          </div>
                        </Td>
                        <Td>
                          <Link
                            href={`/dashboard/inventory/${p.id}/label`}
                            className="text-slate-400 hover:text-violet-700"
                            title={t.printLabel}
                          >
                            🏷️
                          </Link>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ── Orders tab ── */}
      {tab === "orders" && (
        <OrdersTabClient
          orders={orders}
          suppliers={supplierOptions}
          parts={partOptions}
        />
      )}

      {/* ── Suppliers tab ── */}
      {tab === "suppliers" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader title={t.allSuppliers} />
              {suppliers.length === 0 ? (
                <EmptyState message={t.noSuppliersYet} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>{t.name}</Th>
                      <Th>{t.phone}</Th>
                      <Th>{t.email}</Th>
                      <Th>{t.parts}</Th>
                      <Th>{t.purchaseOrders}</Th>
                    </tr>
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
            <CardHeader title={t.addSupplier} />
            <form action={createSupplier} className="space-y-3 p-5">
              <div>
                <Label htmlFor="name">{t.name} *</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="phone">{t.phone}</Label>
                <Input id="phone" name="phone" />
              </div>
              <div>
                <Label htmlFor="email">{t.email}</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div>
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              <Button type="submit" className="w-full">
                {t.addSupplier}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
