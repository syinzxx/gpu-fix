# Ticket & Customer UX Improvements — Design Spec

**Date:** 2026-07-20

**Goal:** Improve the new-ticket intake flow and ticket detail page with five targeted UX changes: warranty back-link, customer search/select, deposit removal, "Customer Request" section with work-type and colored priority, and ETA time-frame presets.

---

## Feature 1 — Warranty back-link on ticket detail

**File:** `app/dashboard/tickets/[id]/page.tsx`

When a ticket has `isWarrantyReturn = true` and `warrantyTicketId` is set (which stores a ticket CODE like "GPU-4F7K2"), the detail page currently renders the code as plain text.

**Change:** In the server component's data fetch, if `ticket.isWarrantyReturn && ticket.warrantyTicketId`, run an additional query:

```ts
const originalTicket = await db.ticket.findUnique({
  where: { code: ticket.warrantyTicketId },
  select: { id: true, code: true },
});
```

Then render as a clickable link:

```tsx
{ticket.isWarrantyReturn && ticket.warrantyTicketId && (
  <>
    {" · "}
    {originalTicket ? (
      <Link href={`/dashboard/tickets/${originalTicket.id}`}
        className="font-medium text-amber-600 hover:underline">
        {t.ref} {ticket.warrantyTicketId}
      </Link>
    ) : (
      <span className="text-amber-600">{t.ref} {ticket.warrantyTicketId}</span>
    )}
  </>
)}
```

If the original ticket is not found (deleted or code mis-typed), fall back to plain text — no error thrown.

**Schema change:** None.

---

## Feature 2 — Customer search/select in new ticket form

### Architecture

The new ticket page (`app/dashboard/tickets/new/page.tsx`) becomes a thin server component:
- Fetches `technicians` (existing query)
- Renders `<NewTicketForm technicians={technicians} />`

The form logic moves to `components/new-ticket-form.tsx` — a `"use client"` component.

### Customer section UX

The Customer card in the form has two modes:

**Search mode (default):**
- A single search input (placeholder: "Search by name or phone…")
- As the user types (≥2 chars), calls `searchCustomers(query)` server action
- Shows a dropdown of up to 8 results: each row shows `{name} · {phone}`
- A "→ View customer database" link below the input pointing to `/dashboard/customers`
- If the user doesn't select anyone and proceeds: fallback to **manual entry mode**

**Selected mode:**
- Dropdown closes; a summary card replaces the search box:
  ```
  ┌─────────────────────────────────────────┐
  │ Ahmed Hassan · 01012345678              │
  │ ahmed@email.com                         │
  │              [Edit]  [Change customer]  │
  └─────────────────────────────────────────┘
  ```
- Hidden `<input name="customerId" value={customer.id} />` is set
- **"Edit" button** — reveals an inline form below the card:
  - Fields: Name, Phone, WhatsApp, Email
  - Submit calls `updateCustomer` server action (already exists in `app/actions/admin.ts`)
  - On success: re-fetches updated customer data (router.refresh() updates server state; the component refreshes its local state from the action result)
- **"Change customer" button** — clears selection, returns to search mode, clears hidden `customerId`

**Manual entry mode (no customer selected):**
- Shows existing fields: Name*, Phone*, WhatsApp, Email
- No `customerId` sent — `createTicket` falls back to match/create by phone (existing behavior)

**No-results state:**
- Dropdown shows "No customers found" + a "Create new customer" option
- Clicking "Create new customer" switches to manual entry mode

### Server action: `searchCustomers`

New file: `app/actions/customers.ts`

```ts
"use server";
import { db } from "@/lib/db";

export async function searchCustomers(query: string) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();
  return db.customer.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, name: true, phone: true, whatsapp: true, email: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}
```

### `createTicket` action update

If `customerId` field is present and non-empty in formData:
- Skip the phone-based lookup/create
- Use `customerId` directly as `customerId` in `db.ticket.create`

```ts
const existingCustomerId = (formData.get("customerId") as string)?.trim();

let customer;
if (existingCustomerId) {
  customer = await db.customer.findUnique({ where: { id: existingCustomerId } });
  if (!customer) throw new Error("Selected customer not found");
} else {
  // existing phone match/create logic
}
```

**Schema change:** None.

---

## Feature 3 — Remove deposit from new ticket form

**Files:**
- `components/new-ticket-form.tsx` — omit the "Deposit (optional)" card entirely
- `app/actions/tickets.ts` — remove two blocks:
  1. The parsing block (~lines 53-58):
     ```ts
     const depositRaw = formData.get("depositAmount") as string;
     const depositAmount = depositRaw ? parseFloat(depositRaw) : 0;
     const depositMethodRaw = (formData.get("depositMethod") as string) || "CASH";
     const depositMethod: PaymentMethod = PAYMENT_METHODS.includes(depositMethodRaw as PaymentMethod)
       ? (depositMethodRaw as PaymentMethod)
       : "CASH";
     ```
  2. The Payment + TicketEvent creation block (~lines 109-128):
     ```ts
     if (depositAmount > 0) {
       await db.payment.create({ ... kind: "DEPOSIT" ... });
       await db.ticketEvent.create({ ... type: "PAYMENT", note: `Deposit recorded...` ... });
     }
     ```
  Also remove the `PaymentMethod` type import from `@/lib/constants` if it is no longer used elsewhere in this file.

**Note:** The deposit/payment workflow remains fully available on the ticket detail page via the "Record Payment" card. This only removes the intake-time deposit collection.

**Schema change:** None.

---

## Feature 4 — "Customer Request" section

### Card rename

The third card on the new ticket form:
- **Before:** title `{t.intake}`
- **After:** title "Customer Request" (new i18n key `t.customerRequest`)

### Work Type dropdown

New field on the `Ticket` model:

```prisma
workType  String?  // NO_POWER | THERMAL_PASTE | THERMAL_PADS | MEMORY | FAN | EIGHT_PIN | BIOS | OTHER
```

New constants in `lib/constants.ts`:

```ts
export const WORK_TYPES = [
  "NO_POWER",
  "THERMAL_PASTE",
  "THERMAL_PADS",
  "MEMORY",
  "FAN",
  "EIGHT_PIN",
  "BIOS",
  "OTHER",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  NO_POWER:       "No Power",
  THERMAL_PASTE:  "Thermal Paste",
  THERMAL_PADS:   "Thermal Pads",
  MEMORY:         "Memory",
  FAN:            "Fan",
  EIGHT_PIN:      "8-pin Replacement",
  BIOS:           "BIOS / Firmware",
  OTHER:          "Other",
};
```

Rendered in the form as a standard `<Select>` with a blank default ("Select work type…"). Value is optional — if not selected, `workType` is stored as `null`.

`createTicket` action reads: `workType: (formData.get("workType") as string) || null`

On the **ticket detail page**, display `workType` alongside the issue summary (e.g., "Work type: Thermal Paste") if set.

### Colored priority pills

Replace the plain `<Select id="priority">` with 4 pill toggle-buttons rendered using the existing `PRIORITY_COLORS` map from `lib/constants.ts`:

```tsx
const [priority, setPriority] = useState("NORMAL");

<div className="flex gap-2 flex-wrap">
  {PRIORITIES.map((p) => (
    <button
      key={p}
      type="button"
      onClick={() => setPriority(p)}
      className={`rounded-full px-3 py-1 text-xs font-bold ring-2 transition-all ${
        priority === p
          ? `${PRIORITY_COLORS[p]} ring-current`
          : "bg-slate-100 text-slate-400 ring-transparent"
      }`}
    >
      {p}
    </button>
  ))}
</div>
<input type="hidden" name="priority" value={priority} />
```

**Schema change:** Add `workType String?` to `Ticket` in `prisma/schema.prisma`. Run `npx prisma migrate dev --name add_ticket_work_type`.

---

## Feature 5 — ETA as preset time frames

Replace the `<Input type="date" name="etaDate">` in the new ticket form with 4 preset buttons. The form is a client component, so this is straightforward.

```tsx
const ETA_PRESETS = [
  { label: "7 days",   days: 7  },
  { label: "14 days",  days: 14 },
  { label: "1 month",  days: 30 },
  { label: "90 days",  days: 90 },
] as const;

const [etaPreset, setEtaPreset] = useState<number | null>(null);

function computeEta(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

<div className="flex gap-2 flex-wrap">
  {ETA_PRESETS.map(({ label, days }) => (
    <button
      key={days}
      type="button"
      onClick={() => setEtaPreset(etaPreset === days ? null : days)}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
        etaPreset === days
          ? "bg-violet-600 text-white ring-violet-600"
          : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"
      }`}
    >
      {label}
    </button>
  ))}
  {etaPreset && (
    <button type="button" onClick={() => setEtaPreset(null)}
      className="text-xs text-slate-400 hover:text-slate-600">
      × Clear
    </button>
  )}
</div>
{etaPreset && (
  <input type="hidden" name="etaDate" value={computeEta(etaPreset)} />
)}
```

**Ticket detail page:** The `etaDate` date-picker card on the detail page keeps the existing `<Input type="date">` — staff can still set a specific date after ticket creation. No change needed there.

**Schema change:** None. `etaDate DateTime?` is unchanged.

---

## i18n keys to add (`lib/i18n.ts`)

Add to both `en` and `ar` blocks:

| Key | EN | AR |
|---|---|---|
| `customerRequest` | "Customer Request" | "طلب العميل" |
| `workType` | "Work Type" | "نوع العمل" |
| `workTypePlaceholder` | "Select work type…" | "اختر نوع العمل…" |
| `viewCustomerDatabase` | "View customer database →" | "عرض قاعدة بيانات العملاء ←" |
| `changeCustomer` | "Change customer" | "تغيير العميل" |
| `createNewCustomer` | "Create new customer" | "إنشاء عميل جديد" |
| `searchCustomerPlaceholder` | "Search by name or phone…" | "ابحث بالاسم أو رقم الهاتف…" |
| `noCustomersFound` | "No customers found" | "لم يتم العثور على عملاء" |
| `ref` | "Ref:" | "مرجع:" |

---

## Files summary

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `workType String?` to Ticket model |
| `prisma/migrations/` | Create | `add_ticket_work_type` migration |
| `lib/constants.ts` | Modify | Add `WORK_TYPES`, `WORK_TYPE_LABELS` |
| `lib/i18n.ts` | Modify | Add 9 new keys to en + ar |
| `app/dashboard/tickets/new/page.tsx` | Modify | Thin server wrapper — fetch technicians, render `<NewTicketForm>` |
| `components/new-ticket-form.tsx` | Create | Full client form: customer search, colored priority pills, ETA presets, work type |
| `app/actions/customers.ts` | Create | `searchCustomers(query)` server action |
| `app/actions/tickets.ts` | Modify | Accept `customerId`, handle `workType`, remove deposit code |
| `app/dashboard/tickets/[id]/page.tsx` | Modify | Look up original ticket by code, render warranty `<Link>` |

---

## Out of scope

- Editing `workType` after ticket creation (can be added later; not in this spec)
- Arabic labels for `WORK_TYPE_LABELS` (using English values in DB; display labels are in i18n)
- The ETA preset buttons on the ticket detail page (detail page keeps the date picker for precise control)
- Customer merge / deduplication
