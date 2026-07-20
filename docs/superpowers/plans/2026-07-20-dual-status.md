# Dual-Layer Ticket Status System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `status` field on Ticket with two fields — `staffStatus` (Open/Pending/Closed, for dashboard filtering) and `customerStatus` (9 detailed values, shown to customer) — where changing `customerStatus` auto-syncs `staffStatus`.

**Architecture:** Add two new Prisma fields alongside the old `status` field, run a one-time migration script to backfill from the old field, update all server actions and UI components to use the new fields, then remove the old field in a final cleanup task. The ticket slide-over gets 3-button staff status control; the ticket detail page gets a customer status dropdown; the tracking page shows `customerStatus` only.

**Tech Stack:** Next.js 15 App Router, Prisma (SQLite, `db push`), Tailwind CSS, TypeScript. No test runner — verify by loading pages in the dev server (already running at http://localhost:3000).

---

## Task 1: Schema — add staffStatus + customerStatus fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the two new fields to the Ticket model**

In `prisma/schema.prisma`, find the `model Ticket` block. After the line `status  String  @default("RECEIVED")`, add:

```prisma
  staffStatus    String        @default("OPEN")      // OPEN | PENDING | CLOSED
  customerStatus String        @default("RECEIVED")  // RECEIVED | DIAGNOSING | WAITING_FOR_PARTS | IN_REPAIR | TESTING | WAITING_FOR_APPROVAL | READY_FOR_PICKUP | CLOSED | CANCELLED
```

Also add a new index after `@@index([status])`:

```prisma
  @@index([staffStatus])
```

The `status` field stays for now — it will be removed in Task 9.

- [ ] **Step 2: Push the schema**

```bash
npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add staffStatus and customerStatus fields to Ticket"
```

---

## Task 2: Constants — dual-layer types, labels, colors, sync map

**Files:**
- Modify: `lib/constants.ts`

- [ ] **Step 1: Add the new constants at the bottom of `lib/constants.ts`**

Append after the existing `WORK_TYPE_LABELS` block:

```ts
// ---------------------------------------------------------------------------
// Dual-layer status system
// ---------------------------------------------------------------------------

export const STAFF_STATUSES = ["OPEN", "PENDING", "CLOSED"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  OPEN:    "Open",
  PENDING: "Pending",
  CLOSED:  "Closed",
};

export const STAFF_STATUS_COLORS: Record<StaffStatus, string> = {
  OPEN:    "bg-blue-100 text-blue-700",
  PENDING: "bg-amber-100 text-amber-700",
  CLOSED:  "bg-slate-100 text-slate-400",
};

export const CUSTOMER_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "WAITING_FOR_PARTS",
  "IN_REPAIR",
  "TESTING",
  "WAITING_FOR_APPROVAL",
  "READY_FOR_PICKUP",
  "CLOSED",
  "CANCELLED",
] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  RECEIVED:             "Received",
  DIAGNOSING:           "Diagnosing",
  WAITING_FOR_PARTS:    "Waiting for Parts",
  IN_REPAIR:            "Under Repair",
  TESTING:              "Testing",
  WAITING_FOR_APPROVAL: "Awaiting Your Approval",
  READY_FOR_PICKUP:     "Ready for Pickup",
  CLOSED:               "Closed",
  CANCELLED:            "Cancelled",
};

export const CUSTOMER_STATUS_LABELS_AR: Record<CustomerStatus, string> = {
  RECEIVED:             "مستلم",
  DIAGNOSING:           "قيد التشخيص",
  WAITING_FOR_PARTS:    "بانتظار القطع",
  IN_REPAIR:            "قيد الإصلاح",
  TESTING:              "قيد الاختبار",
  WAITING_FOR_APPROVAL: "بانتظار موافقتك",
  READY_FOR_PICKUP:     "جاهز للاستلام",
  CLOSED:               "مغلق",
  CANCELLED:            "ملغي",
};

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, string> = {
  RECEIVED:             "bg-slate-100 text-slate-600",
  DIAGNOSING:           "bg-sky-100 text-sky-700",
  WAITING_FOR_PARTS:    "bg-indigo-100 text-indigo-700",
  IN_REPAIR:            "bg-violet-100 text-violet-700",
  TESTING:              "bg-teal-100 text-teal-700",
  WAITING_FOR_APPROVAL: "bg-amber-100 text-amber-700",
  READY_FOR_PICKUP:     "bg-emerald-500 text-white",
  CLOSED:               "bg-slate-100 text-slate-400",
  CANCELLED:            "bg-rose-100 text-rose-500",
};

export const CUSTOMER_TO_STAFF_STATUS: Record<CustomerStatus, StaffStatus> = {
  RECEIVED:             "OPEN",
  DIAGNOSING:           "OPEN",
  WAITING_FOR_PARTS:    "PENDING",
  IN_REPAIR:            "OPEN",
  TESTING:              "OPEN",
  WAITING_FOR_APPROVAL: "PENDING",
  READY_FOR_PICKUP:     "PENDING",
  CLOSED:               "CLOSED",
  CANCELLED:            "CLOSED",
};

export function customerStatusLabelsFor(locale: string): Record<CustomerStatus, string> {
  return locale === "ar" ? CUSTOMER_STATUS_LABELS_AR : CUSTOMER_STATUS_LABELS;
}

export function customerStatusMessage(opts: {
  customerName: string;
  code: string;
  status: CustomerStatus;
  device: string;
  quoteAmount?: number | null;
  eta?: string | null;
}): string {
  const trackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/track/${opts.code}`;
  const shop = process.env.SHOP_NAME ?? "our shop";
  const lines: Record<CustomerStatus, string> = {
    RECEIVED:             `We received your ${opts.device}. Track it anytime: ${trackUrl}`,
    DIAGNOSING:           `Your ${opts.device} is now being diagnosed.`,
    WAITING_FOR_PARTS:    `Parts have been ordered for your ${opts.device}. We'll update you when they arrive.`,
    IN_REPAIR:            `Your ${opts.device} is now being repaired.`,
    TESTING:              `Your ${opts.device} is in final testing.${opts.eta ? ` Expected completion: ${opts.eta}.` : ""}`,
    WAITING_FOR_APPROVAL: `Diagnosis complete. Repair quote: ${opts.quoteAmount ?? "-"}. Please approve or contact us. Track at ${trackUrl}`,
    READY_FOR_PICKUP:     `Your ${opts.device} is ready for pickup! See the summary at ${trackUrl}`,
    CLOSED:               `Ticket ${opts.code} is closed. Thank you for choosing ${shop}! Rate your experience: ${trackUrl}`,
    CANCELLED:            `Ticket ${opts.code} has been cancelled. Contact us if you have questions.`,
  };
  return `Hi ${opts.customerName}, ticket ${opts.code}: ${lines[opts.status]}`;
}

export function buildCustomerStatusLine(opts: {
  status: CustomerStatus;
  device: string;
  quoteAmount?: number | null;
  eta?: string | null;
}): string {
  const { status, device, quoteAmount, eta } = opts;
  const lines: Record<CustomerStatus, string> = {
    RECEIVED:             `We received your ${device}`,
    DIAGNOSING:           `Your ${device} is now being diagnosed`,
    WAITING_FOR_PARTS:    `Parts ordered for your ${device}`,
    IN_REPAIR:            `Your ${device} is now being repaired`,
    TESTING:              `Your ${device} is in final testing${eta ? `. ETA: ${eta}` : ""}`,
    WAITING_FOR_APPROVAL: `Diagnosis complete. Repair quote: ${quoteAmount ?? "-"}`,
    READY_FOR_PICKUP:     `Your ${device} is ready for pickup!`,
    CLOSED:               `Ticket closed. Thank you for choosing us! Please rate your experience`,
    CANCELLED:            `Ticket cancelled`,
  };
  return lines[status];
}
```

The old `statusMessage`, `buildStatusLine`, `STATUS_FLOW`, `STATUS_LABELS`, `STATUS_LABELS_AR`, `STATUS_COLORS`, `ACTIVE_STATUSES`, and `statusLabelsFor` stay in the file for now — they are removed in Task 9.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from `lib/constants.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "feat: add dual-layer status constants (STAFF_STATUSES, CUSTOMER_STATUSES)"
```

---

## Task 3: Migration script — backfill existing tickets

**Files:**
- Create: `scripts/migrate-to-dual-status.ts`

- [ ] **Step 1: Create the migration script**

Create `scripts/migrate-to-dual-status.ts` with this content:

```ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const STATUS_MAP: Record<string, { staffStatus: string; customerStatus: string }> = {
  RECEIVED:                   { staffStatus: "OPEN",    customerStatus: "RECEIVED" },
  DIAGNOSING:                 { staffStatus: "OPEN",    customerStatus: "DIAGNOSING" },
  EXPEDITE_DIAGNOSIS:         { staffStatus: "OPEN",    customerStatus: "DIAGNOSING" },
  WAITING_FOR_PARTS:          { staffStatus: "PENDING", customerStatus: "WAITING_FOR_PARTS" },
  TESTING:                    { staffStatus: "OPEN",    customerStatus: "TESTING" },
  WAITING_FOR_QUOTE_APPROVAL: { staffStatus: "PENDING", customerStatus: "WAITING_FOR_APPROVAL" },
  READY_FOR_PICKUP:           { staffStatus: "PENDING", customerStatus: "READY_FOR_PICKUP" },
  CLOSED:                     { staffStatus: "CLOSED",  customerStatus: "CLOSED" },
};

async function main() {
  const tickets = await db.ticket.findMany({ select: { id: true, status: true } });
  console.log(`Migrating ${tickets.length} tickets...`);
  for (const t of tickets) {
    const mapped = STATUS_MAP[t.status] ?? { staffStatus: "OPEN", customerStatus: "RECEIVED" };
    await db.ticket.update({
      where: { id: t.id },
      data: { staffStatus: mapped.staffStatus, customerStatus: mapped.customerStatus },
    });
  }
  console.log("Done.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the migration**

```bash
npx tsx scripts/migrate-to-dual-status.ts
```

If `tsx` is not installed: `npm install -D tsx` first, then re-run.

Expected output:
```
Migrating N tickets...
Done.
```

- [ ] **Step 3: Verify the backfill in Prisma Studio (optional)**

```bash
npx prisma studio
```

Open `Ticket` table — all rows should have `staffStatus` and `customerStatus` set (not blank).

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-dual-status.ts
git commit -m "feat: one-time migration script to backfill staffStatus/customerStatus"
```

---

## Task 4: Server actions — setCustomerStatus, setStaffStatus, update createTicket

**Files:**
- Modify: `app/actions/tickets.ts`
- Modify: `lib/whatsapp.ts`

- [ ] **Step 1: Update `lib/whatsapp.ts` to accept `CustomerStatus`**

Replace the import line and `sendTicketStatusWhatsapp` signature:

```ts
// Replace this import line:
import { statusMessage, buildStatusLine, type TicketStatus } from "@/lib/constants";

// With:
import {
  customerStatusMessage,
  buildCustomerStatusLine,
  type CustomerStatus,
} from "@/lib/constants";
```

Replace the `sendTicketStatusWhatsapp` function:

```ts
export async function sendTicketStatusWhatsapp(opts: {
  ticketId: string;
  to: string | null | undefined;
  customerName: string;
  code: string;
  status: CustomerStatus;
  device: string;
  quoteAmount?: number | null;
  eta?: string | null;
}): Promise<void> {
  const trackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/track/${opts.code}`;
  await sendWhatsapp({
    ticketId: opts.ticketId,
    to: opts.to,
    body: customerStatusMessage({
      customerName: opts.customerName,
      code: opts.code,
      status: opts.status,
      device: opts.device,
      quoteAmount: opts.quoteAmount,
      eta: opts.eta,
    }),
    templateParams: {
      customerName: opts.customerName,
      code: opts.code,
      statusLine: buildCustomerStatusLine({
        status: opts.status,
        device: opts.device,
        quoteAmount: opts.quoteAmount,
        eta: opts.eta,
      }),
      trackUrl,
    },
  });
}
```

- [ ] **Step 2: Update imports in `app/actions/tickets.ts`**

Replace the existing import line:

```ts
// Remove:
import { STATUS_FLOW, type TicketStatus } from "@/lib/constants";

// Add:
import {
  CUSTOMER_STATUSES,
  STAFF_STATUSES,
  CUSTOMER_TO_STAFF_STATUS,
  type CustomerStatus,
  type StaffStatus,
} from "@/lib/constants";
```

- [ ] **Step 3: Update `createTicket` to set `customerStatus` and `staffStatus`**

In the `db.ticket.create` call, replace:
```ts
// the events.create currently has:
toStatus: "RECEIVED",
```

And add two fields to the `data` object (after `workType`):

```ts
      staffStatus: "OPEN",
      customerStatus: "RECEIVED",
```

Also update the `sendTicketStatusWhatsapp` call at the bottom of `createTicket`:

```ts
  await sendTicketStatusWhatsapp({
    ticketId: ticket.id,
    to: customer.whatsapp,
    customerName: customer.name,
    code: ticket.code,
    status: "RECEIVED" as CustomerStatus,
    device: `${brand} ${model}`,
  });
```

- [ ] **Step 4: Replace `changeStatus` with `setCustomerStatus`**

Delete the entire `changeStatus` function and replace it with:

```ts
export async function setCustomerStatus(formData: FormData) {
  const user = await requireUser();
  const ticketId = formData.get("ticketId") as string;
  const customerStatus = formData.get("customerStatus") as CustomerStatus;
  const quoteRaw = formData.get("quoteAmount") as string | null;

  if (!CUSTOMER_STATUSES.includes(customerStatus)) {
    throw new Error(`Invalid customer status: ${customerStatus}`);
  }

  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { customer: true },
  });

  if (customerStatus === "WAITING_FOR_APPROVAL" && (!quoteRaw || isNaN(parseFloat(quoteRaw)))) {
    throw new Error("A quote amount is required");
  }

  const newStaffStatus = CUSTOMER_TO_STAFF_STATUS[customerStatus];
  const isTerminal = customerStatus === "CLOSED" || customerStatus === "CANCELLED";

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      customerStatus,
      staffStatus: newStaffStatus,
      quoteAmount: customerStatus === "WAITING_FOR_APPROVAL" ? parseFloat(quoteRaw!) : undefined,
      closedAt: isTerminal ? new Date() : undefined,
      events: {
        create: {
          type: "STATUS_CHANGE",
          fromStatus: ticket.customerStatus,
          toStatus: customerStatus,
          isPublic: true,
          createdById: user.id,
        },
      },
    },
  });

  await sendTicketStatusWhatsapp({
    ticketId,
    to: ticket.customer.whatsapp,
    customerName: ticket.customer.name,
    code: ticket.code,
    status: customerStatus,
    device: `${ticket.brand} ${ticket.model}`,
    quoteAmount: customerStatus === "WAITING_FOR_APPROVAL" ? parseFloat(quoteRaw!) : ticket.quoteAmount,
    eta: ticket.etaDate ? fmtDate(ticket.etaDate) : null,
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 5: Add `setStaffStatus` action** (after `setCustomerStatus`)

```ts
export async function setStaffStatus(formData: FormData) {
  const user = await requireUser();
  const ticketId = formData.get("ticketId") as string;
  const staffStatus = formData.get("staffStatus") as StaffStatus;

  if (!STAFF_STATUSES.includes(staffStatus)) {
    throw new Error(`Invalid staff status: ${staffStatus}`);
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      staffStatus,
      closedAt: staffStatus === "CLOSED" ? new Date() : undefined,
    },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 6: Update `resendWhatsapp` to use `customerStatus`**

In the `resendWhatsapp` function, the current line:
```ts
    status: ticket.status as TicketStatus,
```
Change to:
```ts
    status: ticket.customerStatus as CustomerStatus,
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only from files that still import `changeStatus` or `TicketStatus` from constants (those are fixed in later tasks). No errors in `tickets.ts` or `whatsapp.ts` themselves.

- [ ] **Step 8: Commit**

```bash
git add app/actions/tickets.ts lib/whatsapp.ts
git commit -m "feat: add setCustomerStatus + setStaffStatus actions; drop changeStatus"
```

---

## Task 5: Status badge components

**Files:**
- Modify: `components/status-badge.tsx`

- [ ] **Step 1: Replace the file content**

Replace the entire file with:

```tsx
import { Badge } from "@/components/ui";
import {
  STAFF_STATUS_COLORS,
  STAFF_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_STATUS_LABELS,
  PRIORITY_COLORS,
  type StaffStatus,
  type CustomerStatus,
} from "@/lib/constants";

export function StaffStatusBadge({ status }: { status: string }) {
  const s = status as StaffStatus;
  return (
    <Badge className={STAFF_STATUS_COLORS[s] ?? "bg-slate-100 text-slate-600"}>
      {STAFF_STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

export function CustomerStatusBadge({ status }: { status: string }) {
  const s = status as CustomerStatus;
  return (
    <Badge className={CUSTOMER_STATUS_COLORS[s] ?? "bg-slate-100 text-slate-600"}>
      {CUSTOMER_STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "NORMAL") return null;
  return <Badge className={PRIORITY_COLORS[priority] ?? "bg-slate-100 text-slate-600"}>{priority}</Badge>;
}
```

Note: the old `StatusBadge` export is removed here. Every file that imported `StatusBadge` will need to import `StaffStatusBadge` or `CustomerStatusBadge` instead — those files are updated in Tasks 6–8.

- [ ] **Step 2: Commit**

```bash
git add components/status-badge.tsx
git commit -m "feat: add StaffStatusBadge and CustomerStatusBadge components"
```

---

## Task 6: Tickets list — filter pills, table, slide-over

**Files:**
- Modify: `app/dashboard/tickets/page.tsx`
- Modify: `components/tickets-client.tsx`
- Modify: `components/ticket-slide-over.tsx`

### 6a — Update `SlideOverTicket` type and slide-over panel

- [ ] **Step 1: Update `SlideOverTicket` type in `components/ticket-slide-over.tsx`**

Replace the type definition:

```ts
export type SlideOverTicket = {
  id: string;
  code: string;
  staffStatus: string;
  customerStatus: string;
  priority: string;
  etaDate: Date | null;
  createdAt: Date;
  closedAt: Date | null;
  isWarrantyReturn: boolean;
  brand: string;
  model: string;
  deviceType: string;
  assignedToId: string | null;
  customer: { name: string; phone: string };
  assignedTo: { id: string; name: string } | null;
  attachments: { id: string; path: string; kind: string; isPublic: boolean }[];
};
```

- [ ] **Step 2: Update imports at top of `components/ticket-slide-over.tsx`**

Replace:
```ts
import {
  STATUS_FLOW,
  STATUS_LABELS,
  type TicketStatus,
} from "@/lib/constants";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
```

With:
```ts
import {
  STAFF_STATUSES,
  STAFF_STATUS_LABELS,
  STAFF_STATUS_COLORS,
  type StaffStatus,
} from "@/lib/constants";
import { StaffStatusBadge, PriorityBadge } from "@/components/status-badge";
```

- [ ] **Step 3: Replace the status badge in the slide-over header**

Find the line:
```tsx
<StatusBadge status={ticket.status} />
```
Replace with:
```tsx
<StaffStatusBadge status={ticket.staffStatus} />
```

Also find the ETA urgency line — it still references `ticket.status`:
```ts
const urgency = etaUrgency(ticket.etaDate);
```
This is fine — `etaUrgency` only needs `ticket.etaDate`, no status reference needed.

- [ ] **Step 4: Replace the "Move to" section with 3-button staff status control**

Find the block that starts with `{/* Move to */}` and ends with `</section>`. Replace the entire section:

```tsx
          {/* Staff status */}
          <section className="px-5 py-4">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              Ticket status
            </p>
            <div className="flex gap-2">
              {STAFF_STATUSES.map((s) => (
                <form
                  key={s}
                  action={async (fd) => {
                    try {
                      setActionError(null);
                      await setStaffStatus(fd);
                      refresh();
                    } catch (e) {
                      setActionError(e instanceof Error ? e.message : "Failed to update status");
                    }
                  }}
                >
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="staffStatus" value={s} />
                  <button
                    type="submit"
                    disabled={isPending || ticket.staffStatus === s}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-all",
                      ticket.staffStatus === s
                        ? STAFF_STATUS_COLORS[s as StaffStatus]
                        : "bg-white text-slate-500 ring-slate-200 hover:ring-slate-300"
                    )}
                  >
                    {STAFF_STATUS_LABELS[s as StaffStatus]}
                  </button>
                </form>
              ))}
            </div>
          </section>
```

- [ ] **Step 5: Update the import of `changeStatus` in the slide-over**

Replace:
```ts
import { changeStatus, assignTicket, addNote, updateEta } from "@/app/actions/tickets";
```
With:
```ts
import { setStaffStatus, assignTicket, addNote, updateEta } from "@/app/actions/tickets";
```

Also add `cn` to the imports from utils if not already there — `cn` is already imported in this file.

- [ ] **Step 6: Remove unused `nextStatuses` and `urgency`/`etaLabel`/`etaColor` variables that referenced old `STATUS_FLOW`**

Find and remove this line:
```ts
const nextStatuses = STATUS_FLOW[ticket.status as TicketStatus] ?? [];
```

The ETA urgency variables (`urgency`, `etaLabel`, `etaColor`) still work — they reference `ticket.etaDate`, not the old status.

### 6b — Update `TicketsClient` and tickets list page

- [ ] **Step 7: Update `components/tickets-client.tsx` — type and badge**

Change the `labels` interface — replace `status: string` with nothing (status label is still used), this is fine. The only change needed is the import:

Replace:
```ts
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
```
With:
```ts
import { StaffStatusBadge, PriorityBadge } from "@/components/status-badge";
```

In the table body, replace:
```tsx
<Td><StatusBadge status={ticket.status} /></Td>
```
With:
```tsx
<Td><StaffStatusBadge status={ticket.staffStatus} /></Td>
```

- [ ] **Step 8: Update `app/dashboard/tickets/page.tsx` — filter on `staffStatus`**

The file currently has these variables from a previous change:
```ts
const showAll = status === "ALL";
const showOpen = !status || status === "OPEN";
const specificStatus = !showAll && !showOpen ? status : undefined;
```

Replace the entire where-clause logic to filter on `staffStatus`:

```ts
  const showAll = status === "ALL";
  const showOpen = !status || status === "OPEN";
  const showPending = status === "PENDING";
  const showClosed = status === "CLOSED";
  const staffStatusFilter = showPending ? "PENDING" : showClosed ? "CLOSED" : null;
```

Update the `db.ticket.findMany` where clause:

```ts
      where: {
        ...(staffStatusFilter ? { staffStatus: staffStatusFilter } : {}),
        ...(showOpen ? { staffStatus: "OPEN" } : {}),
        // showAll: no staffStatus filter
        ...(q
          ? {
              OR: [
                { code: { contains: q } },
                { brand: { contains: q } },
                { model: { contains: q } },
                { customer: { name: { contains: q } } },
                { customer: { phone: { contains: q } } },
              ],
            }
          : {}),
      },
```

- [ ] **Step 9: Replace the filter pills in `app/dashboard/tickets/page.tsx`**

Remove the import of `STATUSES` and `statusLabelsFor` from constants (no longer needed for pills). Also remove `statusLabels` local variable.

Replace the entire `{/* Status filter pills */}` section with:

```tsx
      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/dashboard/tickets"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            showOpen
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          Open
        </Link>
        <Link
          href="/dashboard/tickets?status=PENDING"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            showPending
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          Pending
        </Link>
        <Link
          href="/dashboard/tickets?status=CLOSED"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            showClosed
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          Closed
        </Link>
        <Link
          href="/dashboard/tickets?status=ALL"
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            showAll
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          All
        </Link>
      </div>
```

Also update the search form hidden input so status is passed correctly:
```tsx
        {status && status !== "ALL" && <input type="hidden" name="status" value={status} />}
```

- [ ] **Step 10: Verify by loading http://localhost:3000/dashboard/tickets**

- Open / Pending / Closed / All pills should appear
- Clicking "Open" shows only OPEN tickets
- Clicking "Pending" shows only PENDING tickets
- Status column shows colored Open/Pending/Closed badges
- Slide-over shows 3 status buttons; clicking one updates the ticket

- [ ] **Step 11: Commit**

```bash
git add app/dashboard/tickets/page.tsx components/tickets-client.tsx components/ticket-slide-over.tsx
git commit -m "feat: dual-status in tickets list and slide-over — Open/Pending/Closed filter and buttons"
```

---

## Task 7: Ticket detail page — customer status card

**Files:**
- Modify: `app/dashboard/tickets/[id]/page.tsx`

- [ ] **Step 1: Update imports**

Replace the existing import from constants:
```ts
// Remove these:
import {
  STATUS_FLOW,
  statusLabelsFor,
  ACTIVE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_KINDS,
  PAYMENT_KIND_COLORS,
  WORK_TYPE_LABELS,
  type TicketStatus,
  type WorkType,
} from "@/lib/constants";

// Replace with:
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  PAYMENT_METHODS,
  PAYMENT_KINDS,
  PAYMENT_KIND_COLORS,
  WORK_TYPE_LABELS,
  type CustomerStatus,
  type WorkType,
} from "@/lib/constants";
```

Replace the action import that includes `changeStatus`:
```ts
// Remove changeStatus from this line:
import {
  changeStatus,        // ← remove this
  addNote,
  assignTicket,
  updateTicketDetails,
  addPartToTicket,
  removePartFromTicket,
  createInvoice,
  resendWhatsapp,
  setWarranty,
} from "@/app/actions/tickets";

// Add setCustomerStatus instead:
import {
  setCustomerStatus,
  addNote,
  assignTicket,
  updateTicketDetails,
  addPartToTicket,
  removePartFromTicket,
  createInvoice,
  resendWhatsapp,
  setWarranty,
} from "@/app/actions/tickets";
```

Replace the badge import:
```ts
// Remove:
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
// Add:
import { StaffStatusBadge, CustomerStatusBadge, PriorityBadge } from "@/components/status-badge";
```

- [ ] **Step 2: Update the variables that used ACTIVE_STATUSES and STATUS_FLOW**

Find and remove:
```ts
  const nextStatuses = STATUS_FLOW[ticket.status as TicketStatus] ?? [];
  const isActive = ACTIVE_STATUSES.includes(ticket.status as TicketStatus);
```

Replace the `queueAhead` query — it currently uses `ACTIVE_STATUSES`:
```ts
// Remove:
    ACTIVE_STATUSES.includes(ticket.status as TicketStatus)
      ? db.ticket.count({
          where: { status: { in: [...ACTIVE_STATUSES] }, createdAt: { lt: ticket.createdAt } },
        })
      : Promise.resolve(0),

// Replace with:
    ticket.staffStatus !== "CLOSED"
      ? db.ticket.count({
          where: { staffStatus: { not: "CLOSED" }, createdAt: { lt: ticket.createdAt } },
        })
      : Promise.resolve(0),
```

Also remove:
```ts
  const statusLabels = statusLabelsFor(locale);
```

- [ ] **Step 3: Update the header badge**

Find:
```tsx
<StatusBadge status={ticket.status} />
```
Replace with:
```tsx
<StaffStatusBadge status={ticket.staffStatus} />
```

- [ ] **Step 4: Update the queue position display**

Find:
```tsx
{isActive && <> · <span className="font-medium text-violet-700">#{queueAhead + 1} {t.queueIn}</span></>}
```
Replace with:
```tsx
{ticket.staffStatus !== "CLOSED" && <> · <span className="font-medium text-violet-700">#{queueAhead + 1} {t.queueIn}</span></>}
```

- [ ] **Step 5: Replace the "Status actions" card with "Customer Status" card**

Find the entire block:
```tsx
      {/* Status actions */}
      {nextStatuses.length > 0 && (
        <Card className="p-5">
          ...
        </Card>
      )}
```

Replace it entirely with:

```tsx
      {/* Customer status */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer status</p>
          <CustomerStatusBadge status={ticket.customerStatus} />
        </div>
        <form action={setCustomerStatus} className="space-y-3">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_STATUSES.map((s) => (
              <button
                key={s}
                type="submit"
                name="customerStatus"
                value={s}
                disabled={ticket.customerStatus === s}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-all",
                  ticket.customerStatus === s
                    ? CUSTOMER_STATUS_COLORS[s as CustomerStatus]
                    : "bg-white text-slate-500 ring-slate-200 hover:ring-slate-300 disabled:opacity-50"
                )}
              >
                {CUSTOMER_STATUS_LABELS[s as CustomerStatus]}
              </button>
            ))}
          </div>
          {ticket.customerStatus !== "WAITING_FOR_APPROVAL" && (
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Set to "Awaiting Approval" with quote:
                </label>
                <input
                  type="number"
                  name="quoteAmount"
                  step="0.01"
                  min="0"
                  defaultValue={ticket.quoteAmount ?? ""}
                  placeholder="Quote amount"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-36 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
            </div>
          )}
          {ticket.customerStatus === "WAITING_FOR_APPROVAL" && ticket.quoteAmount != null && (
            <p className="text-xs text-amber-700">
              Current quote: <strong>{ticket.quoteAmount}</strong> — customer has been notified.
            </p>
          )}
        </form>
        <p className="mt-2 text-xs text-slate-400">{t.statusLoggedWhatsapp}</p>
      </Card>
```

- [ ] **Step 6: Verify by loading a ticket detail page**

- http://localhost:3000/dashboard/tickets/{any-ticket-id}
- Header shows Staff status badge (Open/Pending/Closed)
- New "Customer status" card shows current customer status highlighted
- Clicking a different status button updates it, auto-syncs staff status, fires WhatsApp

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/tickets/[id]/page.tsx
git commit -m "feat: customer status card on ticket detail page"
```

---

## Task 8: Customer tracking page — use customerStatus

**Files:**
- Modify: `app/track/[code]/page.tsx`

- [ ] **Step 1: Update imports**

Replace:
```ts
import {
  statusLabelsFor,
  STATUS_COLORS,
  ACTIVE_STATUSES,
  type TicketStatus,
} from "@/lib/constants";
```

With:
```ts
import {
  customerStatusLabelsFor,
  CUSTOMER_STATUS_COLORS,
  type CustomerStatus,
} from "@/lib/constants";
```

- [ ] **Step 2: Update the `statusLabel` helper and `isActive` / `queuePosition` logic**

Replace:
```ts
  const statusLabel = (s: TicketStatus) => statusLabelsFor(locale)[s];
```
With:
```ts
  const statusLabel = (s: CustomerStatus) => customerStatusLabelsFor(locale)[s];
```

Replace the `isActive` / `queuePosition` block:
```ts
// Remove:
  const status = ticket.status as TicketStatus;
  const isActive = ACTIVE_STATUSES.includes(status);
  const queuePosition = isActive
    ? (await db.ticket.count({
        where: { status: { in: [...ACTIVE_STATUSES] }, createdAt: { lt: ticket.createdAt } },
      })) + 1
    : null;

// Replace with:
  const customerStatus = ticket.customerStatus as CustomerStatus;
  const queuePosition = ticket.staffStatus !== "CLOSED"
    ? (await db.ticket.count({
        where: { staffStatus: { not: "CLOSED" }, createdAt: { lt: ticket.createdAt } },
      })) + 1
    : null;
```

- [ ] **Step 3: Update all status references in the JSX**

Replace:
```tsx
<p className={`mt-2.5 inline-flex rounded-full px-4 py-1.5 text-sm font-bold ${STATUS_COLORS[status]}`}>
  {statusLabel(status)}
</p>
```
With:
```tsx
<p className={`mt-2.5 inline-flex rounded-full px-4 py-1.5 text-sm font-bold ${CUSTOMER_STATUS_COLORS[customerStatus]}`}>
  {statusLabel(customerStatus)}
</p>
```

Replace:
```tsx
{status === "WAITING_FOR_QUOTE_APPROVAL" && ticket.quoteAmount != null && (
```
With:
```tsx
{customerStatus === "WAITING_FOR_APPROVAL" && ticket.quoteAmount != null && (
```

Replace:
```tsx
{status === "READY_FOR_PICKUP" && (
```
With:
```tsx
{customerStatus === "READY_FOR_PICKUP" && (
```

Replace:
```tsx
const showInvoice = ticket.invoice && (status === "READY_FOR_PICKUP" || status === "CLOSED");
```
With:
```tsx
const showInvoice = ticket.invoice && (customerStatus === "READY_FOR_PICKUP" || customerStatus === "CLOSED");
```

Replace:
```tsx
{status === "CLOSED" && (
```
With:
```tsx
{customerStatus === "CLOSED" && (
```

Also update the timeline event renderer — the `toStatus` field on events now contains `CustomerStatus` values:
```tsx
// Find:
<span className="font-semibold text-slate-900">
  {statusLabel(e.toStatus as TicketStatus)}
</span>

// Replace with:
<span className="font-semibold text-slate-900">
  {statusLabel(e.toStatus as CustomerStatus)}
</span>
```

- [ ] **Step 4: Verify the tracking page**

Open http://localhost:3000/track/{any-ticket-code}

- Status badge shows customer status (e.g. "Diagnosing", "Under Repair")
- Queue position appears for non-closed tickets
- Quote approval block appears when customer status is "WAITING_FOR_APPROVAL"
- Rating block appears when customer status is "CLOSED"

- [ ] **Step 5: Commit**

```bash
git add app/track/[code]/page.tsx
git commit -m "feat: tracking page uses customerStatus"
```

---

## Task 9: Update remaining files — track actions, dashboard, queue, customer detail

**Files:**
- Modify: `app/actions/track.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `components/queue-client.tsx`
- Modify: `app/dashboard/customers/[id]/page.tsx`

### 9a — `app/actions/track.ts`

- [ ] **Step 1: Update `approveQuote`**

The current check `ticket.status !== "WAITING_FOR_QUOTE_APPROVAL"` and the update `status: "WAITING_FOR_PARTS"` must both change.

Replace the entire `approveQuote` function:

```ts
export async function approveQuote(formData: FormData) {
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return;
  const code = parsed.data;

  const ticket = await db.ticket.findUnique({
    where: { code },
    include: { customer: { select: { name: true, whatsapp: true } } },
  });
  if (!ticket || ticket.customerStatus !== "WAITING_FOR_APPROVAL") return;

  await db.ticket.update({
    where: { id: ticket.id },
    data: {
      customerStatus: "WAITING_FOR_PARTS",
      staffStatus: "PENDING",
      events: {
        create: {
          type: "STATUS_CHANGE",
          fromStatus: ticket.customerStatus,
          toStatus: "WAITING_FOR_PARTS",
          isPublic: true,
          note: "Approved by customer via tracking page",
          createdById: null,
        },
      },
    },
  });

  await sendTicketStatusWhatsapp({
    ticketId: ticket.id,
    to: ticket.customer.whatsapp,
    customerName: ticket.customer.name,
    code: ticket.code,
    status: "WAITING_FOR_PARTS",
    device: `${ticket.brand} ${ticket.model}`,
    quoteAmount: ticket.quoteAmount,
  });

  revalidatePath(`/track/${ticket.code}`);
  revalidatePath(`/dashboard/tickets/${ticket.id}`);
}
```

- [ ] **Step 2: Update `rejectQuote`**

Replace the entire `rejectQuote` function:

```ts
export async function rejectQuote(formData: FormData) {
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return;
  const code = parsed.data;

  const ticket = await db.ticket.findUnique({
    where: { code },
    include: { customer: { select: { name: true, whatsapp: true } } },
  });
  if (!ticket || ticket.customerStatus !== "WAITING_FOR_APPROVAL") return;

  await db.ticket.update({
    where: { id: ticket.id },
    data: {
      customerStatus: "DIAGNOSING",
      staffStatus: "OPEN",
      events: {
        create: {
          type: "STATUS_CHANGE",
          fromStatus: ticket.customerStatus,
          toStatus: "DIAGNOSING",
          isPublic: true,
          note: "Declined by customer via tracking page",
          createdById: null,
        },
      },
    },
  });

  await sendTicketStatusWhatsapp({
    ticketId: ticket.id,
    to: ticket.customer.whatsapp,
    customerName: ticket.customer.name,
    code: ticket.code,
    status: "DIAGNOSING",
    device: `${ticket.brand} ${ticket.model}`,
    quoteAmount: ticket.quoteAmount,
  });

  revalidatePath(`/track/${ticket.code}`);
  revalidatePath(`/dashboard/tickets/${ticket.id}`);
}
```

- [ ] **Step 3: Update `submitRating`**

The rating gate currently checks `ticket.status !== "CLOSED"`. Change the select and check:

```ts
// In db.ticket.findUnique:
select: { id: true, customerStatus: true, ratedAt: true },

// The guard:
if (!ticket || ticket.customerStatus !== "CLOSED" || ticket.ratedAt) return;
```

### 9b — `app/dashboard/page.tsx`

- [ ] **Step 4: Update imports and queries in the dashboard overview**

Replace:
```ts
import { ACTIVE_STATUSES } from "@/lib/constants";
```
Remove this import entirely (no longer needed).

Replace the three parallel queries in `Promise.all`:

```ts
// Replace:
db.ticket.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
db.ticket.count({ where: { status: "READY_FOR_PICKUP" } }),
db.ticket.count({ where: { status: "WAITING_FOR_QUOTE_APPROVAL" } }),

// With:
db.ticket.count({ where: { staffStatus: { not: "CLOSED" } } }),
db.ticket.count({ where: { customerStatus: "READY_FOR_PICKUP" } }),
db.ticket.count({ where: { customerStatus: "WAITING_FOR_APPROVAL" } }),
```

Replace the `allOpen` query where clause:
```ts
// Replace:
where: { status: { not: "CLOSED" } },

// With:
where: { staffStatus: { not: "CLOSED" } },
```

### 9c — `components/queue-client.tsx`

- [ ] **Step 5: Replace `StatusBadge` with `StaffStatusBadge`**

Replace the import:
```ts
// Replace:
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
// With:
import { StaffStatusBadge, PriorityBadge } from "@/components/status-badge";
```

Find the `StatusBadge` usage in the table body. It currently renders `ticket.status` — change to:
```tsx
<Td><StaffStatusBadge status={ticket.staffStatus} /></Td>
```

### 9d — `app/dashboard/customers/[id]/page.tsx`

- [ ] **Step 6: Replace `StatusBadge` with `StaffStatusBadge`**

Replace the import:
```ts
import { StatusBadge } from "@/components/status-badge";
// →
import { StaffStatusBadge } from "@/components/status-badge";
```

Find the usage (line ~108):
```tsx
<Td><StatusBadge status={ticket.status} /></Td>
// →
<Td><StaffStatusBadge status={ticket.staffStatus} /></Td>
```

- [ ] **Step 7: Verify dashboard**

Open http://localhost:3000/dashboard — stats should load, queue should show without errors.

- [ ] **Step 8: Commit**

```bash
git add app/actions/track.ts app/dashboard/page.tsx components/queue-client.tsx "app/dashboard/customers/[id]/page.tsx"
git commit -m "feat: update track actions, dashboard, queue-client, customer detail to dual-status"
```

---

## Task 10: Cleanup — remove old `status` field and dead constants

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/constants.ts`
- Modify: `app/actions/tickets.ts` (remove unused import remnant if any)

- [ ] **Step 1: Remove `status` field from schema**

In `prisma/schema.prisma`, in `model Ticket`:

Remove:
```prisma
  status       String        @default("RECEIVED")
```

Also remove:
```prisma
  @@index([status])
```

- [ ] **Step 2: Push the schema change**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

SQLite's `db push` will drop the `status` column. Verify in Prisma Studio that the column is gone and all tickets still have `staffStatus` + `customerStatus`.

- [ ] **Step 3: Remove dead code from `lib/constants.ts`**

Delete these entire blocks from `lib/constants.ts`:

```ts
// Remove the old comment at top:
// Status flow:
// RECEIVED -> DIAGNOSING / EXPEDITE_DIAGNOSIS -> ...

// Remove:
export const STATUSES = [...] as const;
export type TicketStatus = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<TicketStatus, string> = {...};
export const STATUS_LABELS_AR: Record<TicketStatus, string> = {...};
export function statusLabelsFor(...) {...}
export const STATUS_FLOW: Record<TicketStatus, TicketStatus[]> = {...};
export const ACTIVE_STATUSES: TicketStatus[] = [...];
export const STATUS_COLORS: Record<TicketStatus, string> = {...};
export function statusMessage(...) {...}
export function buildStatusLine(...) {...}
```

Keep everything else — `PRIORITIES`, `PRIORITY_COLORS`, `DEVICE_TYPES`, `PART_CATEGORIES`, `PAYMENT_METHODS`, `PAYMENT_KINDS`, `PAYMENT_KIND_COLORS`, `EXPENSE_CATEGORIES`, `WORK_TYPES`, `WORK_TYPE_LABELS`, and all the new dual-status constants added in Task 2.

- [ ] **Step 4: Check for any remaining references to old constants**

```bash
npx tsc --noEmit 2>&1
```

Fix any TypeScript errors by updating the remaining reference to use the new types. Common leftover references:
- `TicketStatus` → `CustomerStatus` or `StaffStatus` depending on context
- `STATUS_LABELS` → `CUSTOMER_STATUS_LABELS`
- `STATUS_COLORS` → `CUSTOMER_STATUS_COLORS` or `STAFF_STATUS_COLORS`
- `statusLabelsFor` → `customerStatusLabelsFor`

- [ ] **Step 5: Grep for any stray references**

```bash
grep -r "STATUS_FLOW\|ACTIVE_STATUSES\|STATUS_LABELS\b\|STATUS_COLORS\b\|statusLabelsFor\|TicketStatus\|changeStatus\|statusMessage\b\|buildStatusLine\b" --include="*.ts" --include="*.tsx" app/ components/ lib/
```

Any remaining hits must be fixed.

- [ ] **Step 6: Final smoke test**

Load these pages and verify no errors:
- http://localhost:3000/dashboard/tickets (filter pills, badges)
- http://localhost:3000/dashboard/tickets/{id} (customer status card, detail)
- http://localhost:3000/track/{code} (customer tracking)
- http://localhost:3000/dashboard/tickets/new (create new ticket)

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma lib/constants.ts app/actions/tickets.ts
git commit -m "chore: remove old status field and legacy status constants"
```
