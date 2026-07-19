import Link from "next/link";
import { db } from "@/lib/db";
import { adjustStock } from "@/app/actions/inventory";
import { PART_CATEGORIES } from "@/lib/constants";
import { Card, Table, Th, Td, EmptyState, Badge, Button } from "@/components/ui";
import { money, cn } from "@/lib/utils";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; category?: string; q?: string }>;
}) {
  const { filter, category, q } = await searchParams;

  const parts = await db.part.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [{ sku: { contains: q } }, { name: { contains: q } }],
          }
        : {}),
    },
    include: { supplier: true },
    orderBy: { name: "asc" },
  });

  const shown = filter === "low" ? parts.filter((p) => p.quantity <= p.lowStockThreshold) : parts;
  const lowCount = parts.filter((p) => p.quantity <= p.lowStockThreshold).length;
  const stockValue = parts.reduce((s, p) => s + p.quantity * p.costPrice, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Inventory</h1>
        <Link
          href="/dashboard/inventory/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500"
        >
          + New Part
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="silk-label text-slate-400">Distinct parts</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">{parts.length}</p>
        </Card>
        <Card className="p-4">
          <p className="silk-label text-slate-400">Low stock</p>
          <p className={cn("mt-1 font-display text-3xl font-bold tracking-tight", lowCount > 0 ? "text-rose-600" : "text-slate-900")}>{lowCount}</p>
        </Card>
        <Card className="p-4">
          <p className="silk-label text-slate-400">Stock value (cost)</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">{money(stockValue)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/inventory"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            !filter && !category ? "bg-slate-900 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
          )}
        >
          All
        </Link>
        <Link
          href="/dashboard/inventory?filter=low"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            filter === "low" ? "bg-rose-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
          )}
        >
          Low stock
        </Link>
        {PART_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/dashboard/inventory?category=${c}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              category === c ? "bg-slate-900 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
            )}
          >
            {c}
          </Link>
        ))}
      </div>

      <form className="max-w-sm">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Scan or search SKU / part name…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
        {category && <input type="hidden" name="category" value={category} />}
        {filter && <input type="hidden" name="filter" value={filter} />}
      </form>

      <Card>
        {shown.length === 0 ? (
          <EmptyState message="No parts found." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th><Th>Part</Th><Th>Category</Th><Th>Stock</Th>
                <Th>Cost</Th><Th>Sell</Th><Th>Supplier</Th><Th>Adjust</Th><Th>Label</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const low = p.quantity <= p.lowStockThreshold;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs">{p.sku}</Td>
                    <Td>
                      <Link href={`/dashboard/inventory/${p.id}`} className="font-semibold text-violet-700 hover:underline">
                        {p.name}
                      </Link>
                    </Td>
                    <Td><Badge className="bg-slate-100 text-slate-600">{p.category}</Badge></Td>
                    <Td>
                      <span className={cn("font-bold", low && "text-rose-600")}>{p.quantity}</span>
                      {low && <Badge className="ml-2 bg-rose-100 text-rose-700">low</Badge>}
                    </Td>
                    <Td>{money(p.costPrice)}</Td>
                    <Td>{money(p.sellPrice)}</Td>
                    <Td className="text-xs text-slate-500">{p.supplier?.name ?? "—"}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <form action={adjustStock}>
                          <input type="hidden" name="partId" value={p.id} />
                          <input type="hidden" name="delta" value="-1" />
                          <Button size="sm" variant="secondary" type="submit" disabled={p.quantity === 0}>−</Button>
                        </form>
                        <form action={adjustStock}>
                          <input type="hidden" name="partId" value={p.id} />
                          <input type="hidden" name="delta" value="1" />
                          <Button size="sm" variant="secondary" type="submit">+</Button>
                        </form>
                      </div>
                    </Td>
                    <Td>
                      <Link
                        href={`/dashboard/inventory/${p.id}/label`}
                        className="text-slate-400 hover:text-violet-700"
                        title="Print label"
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
    </div>
  );
}
