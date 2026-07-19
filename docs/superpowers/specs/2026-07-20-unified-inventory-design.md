# Unified Inventory Management Design

**Goal:** Merge `/dashboard/inventory`, `/dashboard/purchase-orders`, and `/dashboard/suppliers` into a single tabbed page at `/dashboard/inventory?tab=parts|orders|suppliers`.

**Approach:** Server-component tabs. The page reads `?tab` from `searchParams`, fetches all data server-side, and renders the active tab. Tab links are plain `<Link>` elements — no client state needed for tab switching. The "New Order" button opens a slide-over panel (same pattern as `TicketSlideOver`).

---

## URL Structure

| URL | Tab shown |
|-----|-----------|
| `/dashboard/inventory` | Parts (default) |
| `/dashboard/inventory?tab=parts` | Parts |
| `/dashboard/inventory?tab=orders` | Purchase Orders |
| `/dashboard/inventory?tab=suppliers` | Suppliers |

Old routes redirect to new tabs:
- `/dashboard/purchase-orders` → `/dashboard/inventory?tab=orders`
- `/dashboard/suppliers` → `/dashboard/inventory?tab=suppliers`

---

## Files

### Create
- `app/dashboard/purchase-orders/page.tsx` — redirect to `/dashboard/inventory?tab=orders`
- `app/dashboard/suppliers/page.tsx` — redirect to `/dashboard/inventory?tab=suppliers`
- `components/purchase-order-slide-over.tsx` — client component for new PO form

### Modify
- `app/dashboard/inventory/page.tsx` — add tab bar + conditional rendering of Parts/Orders/Suppliers content
- `app/dashboard/layout.tsx` — remove "Purchase Orders" and "Suppliers" from NAV array; keep single "Inventory" entry
- `app/actions/inventory.ts` — update `revalidatePath` calls in `createSupplier`, `createPurchaseOrder`, `receivePurchaseOrder`, `cancelPurchaseOrder` to use `/dashboard/inventory` instead of old paths

---

## Tab: Parts

Identical to current `/dashboard/inventory` content:
- 3 stat cards (distinct parts, low stock count, stock value)
- Filter pills (All, Low Stock, category pills from `PART_CATEGORIES`)
- Search form (`?q=`)
- Parts table: SKU | Name | Category | Stock | Cost | Sell | Supplier | Adjust (+/−) | Label link
- "New Part" button links to `/dashboard/inventory/new` (unchanged)

Existing `?filter=`, `?category=`, `?q=` params continue to work alongside `?tab=`.

---

## Tab: Purchase Orders

Identical to current `/dashboard/purchase-orders` content:
- List of POs as cards (number, supplier, status badge, items table, Receive/Cancel buttons)
- Empty state when no orders
- **"New Order" button** opens `PurchaseOrderSlideOver` instead of navigating to `/dashboard/purchase-orders/new`

`PurchaseOrderSlideOver` (new client component):
- Props: `suppliers: { id: string; name: string }[]`, `parts: { id: string; name: string; sku: string; costPrice: number }[]`
- Form fields: supplier select (required), optional notes textarea, dynamic line items
- Line items: each row has part select + qty input + unit cost input; "Add item" button appends a row; "×" removes a row; minimum 1 item to submit
- Submit calls `createPurchaseOrder` server action; on success closes panel + `router.refresh()`; on error shows error banner (same pattern as `TicketSlideOver`)
- Backdrop click and Esc close the panel

---

## Tab: Suppliers

Identical to current `/dashboard/suppliers` layout:
- 2-column grid: suppliers table (lg:col-span-2) + inline Add Supplier form card (col-span-1)
- Table: Name | Phone | Email | Parts count | PO count
- Form: name (required), phone, email, notes, submit button
- Form calls `createSupplier` server action directly (no slide-over)

No "Add Supplier" button needed — form is always visible in the right panel.

---

## Sidebar

Remove from `NAV` in `app/dashboard/layout.tsx`:
- `{ href: "/dashboard/purchase-orders", ... }`
- `{ href: "/dashboard/suppliers", ... }`

Keep:
- `{ href: "/dashboard/inventory", label: t.inventory, icon: "▦" }`

---

## Action Revalidation Updates

| Action | Old `revalidatePath` | New `revalidatePath` |
|--------|---------------------|---------------------|
| `createSupplier` | `/dashboard/suppliers` | `/dashboard/inventory` |
| `createPurchaseOrder` | `/dashboard/purchase-orders` | `/dashboard/inventory` |
| `receivePurchaseOrder` | `/dashboard/purchase-orders`, `/dashboard/inventory` | `/dashboard/inventory` (both merged) |
| `cancelPurchaseOrder` | `/dashboard/purchase-orders` | `/dashboard/inventory` |

---

## i18n

No new translation keys needed — all existing keys (`t.purchaseOrders`, `t.suppliers`, `t.inventory`, etc.) are reused. Tab labels use existing keys.

---

## Out of Scope

- `/dashboard/inventory/new` (new part form) — unchanged
- `/dashboard/inventory/[id]` (edit part) — unchanged
- `/dashboard/purchase-orders/new` — becomes dead (replaced by slide-over); the page can be deleted after the slide-over is working
