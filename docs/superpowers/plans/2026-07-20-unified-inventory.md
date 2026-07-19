# Unified Inventory Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Inventory, Purchase Orders, and Suppliers into a single tabbed page at `/dashboard/inventory?tab=parts|orders|suppliers`, with a slide-over for creating purchase orders.

**Architecture:** Server-component tabs — `app/dashboard/inventory/page.tsx` reads `?tab` from `searchParams`, fetches all data server-side in one `Promise.all`, and renders the active tab. Tab links are plain `<Link>` elements. A thin `OrdersTabClient` client component owns the slide-over open/closed state for the New Order form. Old routes (`/dashboard/purchase-orders`, `/dashboard/suppliers`) become redirect pages.

**Tech Stack:** Next.js 15 App Router, Prisma (SQLite), Tailwind CSS, `components/ui.tsx` (Button, Input, Select, Textarea, Card, CardHeader, Table, Th, Td, Badge, EmptyState, Label), server actions (`"use server"`), client components (`"use client"`, `useTransition`, `useState`, `useCallback`, `useEffect`, `useRouter`).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/dashboard/layout.tsx` | Modify | Remove Purchase Orders + Suppliers from NAV |
| `app/dashboard/purchase-orders/page.tsx` | Replace | Redirect → `/dashboard/inventory?tab=orders` |
| `app/dashboard/suppliers/page.tsx` | Replace | Redirect → `/dashboard/inventory?tab=suppliers` |
| `app/actions/inventory.ts` | Modify | Update `revalidatePath` + remove stale `redirect` calls |
| `components/purchase-order-slide-over.tsx` | Create | Slide-over form for creating a new PO |
| `components/orders-tab-client.tsx` | Create | Client wrapper: PO list + slide-over open state |
| `app/dashboard/inventory/page.tsx` | Replace | Tabbed page: Parts / Purchase Orders / Suppliers |

---

## Task 1: Update sidebar + add redirect pages

**Files:**
- Modify: `app/dashboard/layout.tsx`
- Replace: `app/dashboard/purchase-orders/page.tsx`
- Replace: `app/dashboard/suppliers/page.tsx`

- [ ] **Step 1: Remove PO and Suppliers from the sidebar NAV**

In `app/dashboard/layout.tsx`, find the `NAV` array and delete the two entries for purchase-orders and suppliers. The array should go from 10 items to 8 items:

```tsx
const NAV: (NavItem & { adminOnly?: boolean; roles?: string[] })[] = [
  { href: "/dashboard", label: t.overview, icon: "◈" },
  { href: "/dashboard/tickets", label: t.tickets, icon: "▤" },
  { href: "/dashboard/inventory", label: t.inventory, icon: "▦" },
  // DELETE the two lines below:
  // { href: "/dashboard/purchase-orders", label: t.purchaseOrders, icon: "⬡" },
  // { href: "/dashboard/suppliers", label: t.suppliers, icon: "⬒" },
  { href: "/dashboard/customers", label: t.customers, icon: "◔" },
  { href: "/dashboard/reports", label: t.reports, icon: "◫" },
  { href: "/dashboard/expenses", label: t.expenses, icon: "▧", roles: ["ADMIN", "RECEPTIONIST"] },
  { href: "/dashboard/users", label: t.staff, icon: "◍", adminOnly: true },
  { href: "/dashboard/settings", label: t.settings, icon: "⚙", adminOnly: true },
];
```

- [ ] **Step 2: Replace `/dashboard/purchase-orders/page.tsx` with a redirect**

Overwrite the entire file:

```tsx
import { redirect } from "next/navigation";

export default function PurchaseOrdersPage() {
  redirect("/dashboard/inventory?tab=orders");
}
```

- [ ] **Step 3: Replace `/dashboard/suppliers/page.tsx` with a redirect**

Overwrite the entire file:

```tsx
import { redirect } from "next/navigation";

export default function SuppliersPage() {
  redirect("/dashboard/inventory?tab=suppliers");
}
```

- [ ] **Step 4: Verify manually**

Start the dev server (`npm run dev`). Visit:
- `/dashboard/purchase-orders` → should redirect to `/dashboard/inventory?tab=orders` (page currently shows old content but redirect works)
- `/dashboard/suppliers` → should redirect to `/dashboard/inventory?tab=suppliers`
- Sidebar should now show no "Purchase Orders" or "Suppliers" entries

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/layout.tsx app/dashboard/purchase-orders/page.tsx app/dashboard/suppliers/page.tsx
git commit -m "feat: collapse inventory/PO/suppliers nav into single Inventory entry"
```

---

## Task 2: Fix action revalidation

**Files:**
- Modify: `app/actions/inventory.ts`

The actions currently `redirect()` to old URLs and `revalidatePath()` old paths. This task updates them so the unified page refreshes correctly. The `createPurchaseOrder` and `createSupplier` actions must also **drop their `redirect()` calls** so the slide-over / server-rendered form can stay on the page after submit.

- [ ] **Step 1: Update `createSupplier`**

Find the `createSupplier` function. Replace the final two lines:

Before:
```ts
  revalidatePath("/dashboard/suppliers");
  redirect("/dashboard/suppliers");
```

After:
```ts
  revalidatePath("/dashboard/inventory");
```

(Remove the `redirect` import if it becomes unused — check if other functions still use it first. `createPart`, `updatePart`, and `createPurchaseOrder` also call `redirect`, so leave the import.)

- [ ] **Step 2: Update `createPurchaseOrder`**

Find the `createPurchaseOrder` function. Replace the final two lines:

Before:
```ts
  revalidatePath("/dashboard/purchase-orders");
  redirect("/dashboard/purchase-orders");
```

After:
```ts
  revalidatePath("/dashboard/inventory");
```

- [ ] **Step 3: Update `receivePurchaseOrder`**

Find the `receivePurchaseOrder` function. It currently revalidates two paths. Collapse to one:

Before:
```ts
  revalidatePath("/dashboard/purchase-orders");
  revalidatePath("/dashboard/inventory");
```

After:
```ts
  revalidatePath("/dashboard/inventory");
```

- [ ] **Step 4: Update `cancelPurchaseOrder`**

Find the `cancelPurchaseOrder` function:

Before:
```ts
  revalidatePath("/dashboard/purchase-orders");
```

After:
```ts
  revalidatePath("/dashboard/inventory");
```

- [ ] **Step 5: Verify the file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `app/actions/inventory.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/actions/inventory.ts
git commit -m "fix: update revalidatePath to /dashboard/inventory in all inventory actions"
```

---

## Task 3: Create PurchaseOrderSlideOver component

**Files:**
- Create: `components/purchase-order-slide-over.tsx`

This is a client component. It wraps the existing `PoItemRows` component (already in `components/po-items.tsx`) and calls the `createPurchaseOrder` server action. It follows the exact same pattern as `components/ticket-slide-over.tsx`: backdrop + panel, Esc to close, error banner, `router.refresh()` after success.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useTransition, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Label, Select, Textarea } from "@/components/ui";
import { PoItemRows } from "@/components/po-items";
import { createPurchaseOrder } from "@/app/actions/inventory";

export type SupplierOption = { id: string; name: string };
export type PartOption = { id: string; name: string; sku: string; costPrice: number };

export function PurchaseOrderSlideOver({
  suppliers,
  parts,
  onClose,
}: {
  suppliers: SupplierOption[];
  parts: PartOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = useCallback(
    () => startTransition(() => { router.refresh(); }),
    [router, startTransition]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New Purchase Order"
        className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-white">New Purchase Order</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form
          action={async (fd) => {
            try {
              setError(null);
              await createPurchaseOrder(fd);
              onClose();
              refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to create order");
            }
          }}
          className="flex-1 space-y-4 p-5"
        >
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

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            Create order
          </Button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/purchase-order-slide-over.tsx
git commit -m "feat: add PurchaseOrderSlideOver client component"
```

---

## Task 4: Create OrdersTabClient component

**Files:**
- Create: `components/orders-tab-client.tsx`

This client component owns the `isOpen` state for the slide-over and renders the purchase orders list (the same content as the old `app/dashboard/purchase-orders/page.tsx`, adapted for client-side action calls with `router.refresh()`).

- [ ] **Step 1: Create the file**

```tsx
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
                            await receivePurchaseOrder(fd);
                            refresh();
                          }}
                        >
                          <input type="hidden" name="id" value={po.id} />
                          <Button size="sm" type="submit">Receive → restock</Button>
                        </form>
                        <form
                          action={async (fd) => {
                            await cancelPurchaseOrder(fd);
                            refresh();
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/orders-tab-client.tsx
git commit -m "feat: add OrdersTabClient with PO list and slide-over trigger"
```

---

## Task 5: Rebuild inventory page with tabs

**Files:**
- Replace: `app/dashboard/inventory/page.tsx`

This is the main task. The page fetches all data server-side and renders the active tab based on `?tab=`. The Parts tab shows the existing inventory content. The Orders tab renders `<OrdersTabClient>`. The Suppliers tab renders the existing suppliers layout inline.

- [ ] **Step 1: Replace the entire file**

```tsx
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

  const [allParts, suppliers, orders, t] = await Promise.all([
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

  // Parts tab: apply filters in memory (all parts already fetched for slide-over)
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

With dev server running:

1. Navigate to `/dashboard/inventory` — Parts tab active, stat cards visible, parts table shown
2. Click "Purchase Orders" tab — URL becomes `?tab=orders`, PO list visible, "+ New order" button present
3. Click "+ New order" — slide-over opens, supplier select + PoItemRows + notes visible
4. Select a supplier, add 1 item, click "Create order" — slide-over closes, new PO appears in list
5. Click a PENDING PO's "Receive → restock" — PO status changes to RECEIVED
6. Click "Suppliers" tab — URL becomes `?tab=suppliers`, suppliers table + add-supplier form visible
7. Fill in supplier name, click "Add supplier" — page refreshes, new supplier appears in table
8. On Parts tab, click a category pill (e.g. FAN) — URL becomes `?tab=parts&category=FAN`, table filters
9. On Parts tab, click Low Stock filter — shows only low-stock parts
10. Navigate directly to `/dashboard/purchase-orders` — should redirect to Orders tab
11. Navigate directly to `/dashboard/suppliers` — should redirect to Suppliers tab
12. Sidebar shows only one "Inventory" entry (no separate PO or Suppliers items)

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/inventory/page.tsx
git commit -m "feat: unified inventory page with Parts / Purchase Orders / Suppliers tabs"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Single URL `/dashboard/inventory?tab=` — implemented
- ✅ Sidebar collapsed to one Inventory entry — Task 1
- ✅ Old routes redirect — Task 1
- ✅ Parts tab: stat cards, filter pills, search, table, +/− buttons — Task 5
- ✅ Orders tab: PO list, Receive/Cancel, slide-over for new PO — Tasks 3+4+5
- ✅ Suppliers tab: table + inline Add Supplier form — Task 5
- ✅ revalidatePath updated — Task 2
- ✅ `/dashboard/inventory/new` unchanged — not touched

**Type consistency:**
- `SupplierOption` and `PartOption` exported from `purchase-order-slide-over.tsx`, imported in `orders-tab-client.tsx` — consistent
- `PurchaseOrderData` defined in `orders-tab-client.tsx`, used only within it — consistent

**No placeholder text remains.**
