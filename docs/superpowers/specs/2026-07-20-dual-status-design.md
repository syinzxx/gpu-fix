# Dual-Layer Ticket Status System — Design Spec

**Date:** 2026-07-20

**Goal:** Replace the current single 8-value status field with two separate status fields: a simple 3-state staff status (Open/Pending/Closed) for dashboard filtering, and a 9-state customer status (Diagnosing, Waiting for Parts, etc.) that the technician sets from inside the ticket and that customers see on the tracking page and in the timeline.

**Architecture:** Add two new Prisma fields (`staffStatus`, `customerStatus`) to replace the current `status` field. A server-side mapping table auto-syncs `staffStatus` whenever `customerStatus` changes, so the tech only ever sets one thing. WhatsApp notifications fire on `customerStatus` changes. The dashboard filters on `staffStatus`. The tracking page and timeline show `customerStatus`.

---

## Status Definitions

### Staff Status (`staffStatus`) — 3 values

| Value | Label | Meaning |
|---|---|---|
| `OPEN` | Open | Tech is actively working on the device |
| `PENDING` | Pending | Waiting for something external (parts, customer response, pickup) |
| `CLOSED` | Closed | Ticket done — device picked up or cancelled |

Updated by the tech from the **dashboard slide-over panel** (replacing the current long status dropdown). Used only for filtering the tickets list. Never shown on the customer tracking page.

### Customer Status (`customerStatus`) — 9 values

| Value | Label (EN) | Label (AR) | Auto-syncs staffStatus to |
|---|---|---|---|
| `RECEIVED` | Received | مستلم | `OPEN` |
| `DIAGNOSING` | Diagnosing | قيد التشخيص | `OPEN` |
| `WAITING_FOR_PARTS` | Waiting for Parts | بانتظار القطع | `PENDING` |
| `IN_REPAIR` | Under Repair | قيد الإصلاح | `OPEN` |
| `TESTING` | Testing | قيد الاختبار | `OPEN` |
| `WAITING_FOR_APPROVAL` | Awaiting Your Approval | بانتظار موافقتك | `PENDING` |
| `READY_FOR_PICKUP` | Ready for Pickup | جاهز للاستلام | `PENDING` |
| `CLOSED` | Closed | مغلق | `CLOSED` |
| `CANCELLED` | Cancelled | ملغي | `CLOSED` |

Updated by the tech from the **ticket detail page**. Shown on the customer tracking page (prominently) and logged to the timeline on every change. When `customerStatus` changes, `staffStatus` auto-updates per the table above — the tech never sets both manually.

### Removed status

`EXPEDITE_DIAGNOSIS` is removed. Fast-track diagnosis is now expressed by setting **priority to URGENT** on the ticket, which already exists and has its own visual treatment. No data loss — existing tickets with this status will migrate to `DIAGNOSING`.

---

## Auto-sync Rule

```ts
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
```

The `setCustomerStatus` server action applies this mapping and writes both fields in a single `db.ticket.update` call.

---

## Quote Approval Flow

The existing quote approval flow (`WAITING_FOR_QUOTE_APPROVAL`) maps to `customerStatus: WAITING_FOR_APPROVAL`. The customer tracking page continues to show the approve/reject buttons when `customerStatus === "WAITING_FOR_APPROVAL"` and `ticket.quoteAmount != null`.

---

## Dashboard Tickets List

### Filter pills (replacing current 8-pill list)

```
Open  ·  Pending  ·  Closed  ·  All
```

- **Open** (default) — `staffStatus = "OPEN"`
- **Pending** — `staffStatus = "PENDING"`
- **Closed** — `staffStatus = "CLOSED"`
- **All** — no filter

The existing `?status=ALL` URL convention is kept for "All". Individual status pills are removed.

### Status badge in table

The tickets table shows the `staffStatus` badge (Open / Pending / Closed) in the Status column. The customer status is not shown in the list — only in the slide-over and detail page.

### Slide-over panel

The "Move to" section is replaced with a simple 3-button group: **Open | Pending | Closed**. Clicking one calls `setStaffStatus` server action. The detailed customer status is not settable from here — that's only in the ticket detail page.

---

## Ticket Detail Page

### Customer status section

A new "Customer Status" card replaces the old "Status" section. It shows:
- Current `customerStatus` as a colored badge
- A dropdown or button grid to change it (all 9 values available)
- Changing it calls `setCustomerStatus` action, which auto-updates `staffStatus` and appends a `STATUS_CHANGE` event to the timeline

### Timeline

Events already log `toStatus`. The timeline now logs `customerStatus` changes (not `staffStatus` changes — those are too granular for customers). The public tracking page shows this same timeline.

---

## Customer Tracking Page (`/track/[code]`)

- Shows `customerStatus` badge (not `staffStatus`)
- Arabic/English labels from the new `CUSTOMER_STATUS_LABELS` / `CUSTOMER_STATUS_LABELS_AR` maps
- Quote approval block still triggers on `customerStatus === "WAITING_FOR_APPROVAL"`
- "Ready for Pickup" banner still triggers on `customerStatus === "READY_FOR_PICKUP"`
- Rating block triggers on `customerStatus === "CLOSED"` (same as before)

---

## WhatsApp Notifications

The existing `statusMessage()` and `buildStatusLine()` functions in `lib/constants.ts` are updated to accept `CustomerStatus` instead of `TicketStatus`. The 9 new customer statuses replace the old 8. WhatsApp fires on `customerStatus` change (same trigger as before, different values).

---

## Schema Changes (`prisma/schema.prisma`)

```prisma
model Ticket {
  // Replace:
  // status  String  @default("RECEIVED")

  // With:
  staffStatus    String  @default("OPEN")      // OPEN | PENDING | CLOSED
  customerStatus String  @default("RECEIVED")  // RECEIVED | DIAGNOSING | WAITING_FOR_PARTS | IN_REPAIR | TESTING | WAITING_FOR_APPROVAL | READY_FOR_PICKUP | CLOSED | CANCELLED
  
  // closedAt already exists — populated when customerStatus → CLOSED or CANCELLED
}
```

Applied with `npx prisma db push` (project uses push, not migrate).

### Data migration (run once after push)

```ts
// Map old status → new staffStatus + customerStatus
const STATUS_MIGRATION: Record<string, { staffStatus: string; customerStatus: string }> = {
  RECEIVED:                    { staffStatus: "OPEN",    customerStatus: "RECEIVED" },
  DIAGNOSING:                  { staffStatus: "OPEN",    customerStatus: "DIAGNOSING" },
  EXPEDITE_DIAGNOSIS:          { staffStatus: "OPEN",    customerStatus: "DIAGNOSING" },
  WAITING_FOR_PARTS:           { staffStatus: "PENDING", customerStatus: "WAITING_FOR_PARTS" },
  TESTING:                     { staffStatus: "OPEN",    customerStatus: "TESTING" },
  WAITING_FOR_QUOTE_APPROVAL:  { staffStatus: "PENDING", customerStatus: "WAITING_FOR_APPROVAL" },
  READY_FOR_PICKUP:            { staffStatus: "PENDING", customerStatus: "READY_FOR_PICKUP" },
  CLOSED:                      { staffStatus: "CLOSED",  customerStatus: "CLOSED" },
};
```

A one-time migration script reads existing tickets and backfills `staffStatus` and `customerStatus` from the old `status` field before it is dropped.

---

## Constants Changes (`lib/constants.ts`)

Replace:
- `STATUSES` → `STAFF_STATUSES` + `CUSTOMER_STATUSES`
- `STATUS_LABELS` → `STAFF_STATUS_LABELS` + `CUSTOMER_STATUS_LABELS`
- `STATUS_LABELS_AR` → `CUSTOMER_STATUS_LABELS_AR`
- `STATUS_FLOW` → `CUSTOMER_TO_STAFF_STATUS` auto-sync map
- `ACTIVE_STATUSES` → derived from `staffStatus !== "CLOSED"` where needed
- `STATUS_COLORS` → `STAFF_STATUS_COLORS` + `CUSTOMER_STATUS_COLORS`
- `statusMessage()` + `buildStatusLine()` → updated to use `CustomerStatus`
- `statusLabelsFor()` → kept, updated to use `CustomerStatus`

---

## Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Replace `status` with `staffStatus` + `customerStatus` |
| `lib/constants.ts` | Replace all status constants with dual-layer equivalents |
| `app/actions/tickets.ts` | `createTicket` sets both; add `setCustomerStatus` + `setStaffStatus` actions; update `changeStatus`; remove `WAITING_FOR_QUOTE_APPROVAL` special case; add `CANCELLED` handling that sets `closedAt` |
| `app/dashboard/tickets/page.tsx` | Filter on `staffStatus`; update tableLabels |
| `components/tickets-client.tsx` | Show `staffStatus` badge; update labels type |
| `components/ticket-slide-over.tsx` | `SlideOverTicket` type uses `staffStatus`; slide-over shows 3-button staff status control |
| `components/status-badge.tsx` | Update `StatusBadge` for new staff status values + new `CustomerStatusBadge` component |
| `app/dashboard/tickets/[id]/page.tsx` | Show `customerStatus`; add customer status update card |
| `app/track/[code]/page.tsx` | Use `customerStatus` everywhere instead of `status` |
| `lib/i18n.ts` | Add new i18n keys for new statuses |

---

## Out of Scope

- Editing `staffStatus` independently from `customerStatus` for edge cases (can add later)
- Per-status email notifications (WhatsApp only, as before)
- Customer cannot set their own status (read-only on tracking page)
- Reporting/analytics breakdown by customer status (future feature)
