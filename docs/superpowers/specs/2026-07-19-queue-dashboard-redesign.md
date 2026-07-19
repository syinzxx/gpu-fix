# Queue Dashboard Redesign — Design Spec

**Date:** 2026-07-19  
**Status:** Approved  

---

## Problem

The queue dashboard has two related pain points:

1. **No ETA visibility** — staff cannot tell at a glance which jobs are overdue or due today. The list is sorted by received date descending, so urgent overdue jobs are buried.
2. **Status updates require full page navigation** — changing a ticket's status, reassigning a technician, or uploading a warranty photo requires navigating into the full detail page and back, making routine 5-second actions slow.

---

## Goals

- Surface overdue and due-today tickets immediately on both the overview and tickets list pages.
- Let staff change status, reassign, update ETA, post a note, and upload a photo without ever leaving the list view.
- Make both pages feel like a coherent pair (same columns, same row behaviour, same sort order).

---

## Scope

**In scope:**
- `/dashboard` (overview) — stat cards, queue table
- `/dashboard/tickets` (tickets list) — full list, filters, search
- New shared `TicketSlideOver` client component

**Out of scope:**
- Full ticket detail page (`/dashboard/tickets/[id]`) — no changes
- Kanban/board view — not needed given slide-over solves the workflow
- Mobile-specific layout — existing responsive behaviour preserved

---

## Design

### 1. ETA Urgency System

Four display states for the ETA column, computed at render time:

| State | Condition | Colour | Indicator |
|---|---|---|---|
| Overdue | `etaDate < today` | Red (#dc2626) | ● Overdue |
| Due today | `etaDate === today` | Amber (#d97706) | ● Due today |
| Future | `etaDate > today` | Green (#16a34a) | ● Jul 24 |
| No ETA | `etaDate === null` | Grey | — |

Row-level urgency: overdue rows get a `border-l-2 border-red-400 bg-red-50/40` highlight. Due-today rows get `border-l-2 border-amber-400 bg-amber-50/30`.

### 2. Sort Order (both pages, default)

1. Priority rank: URGENT → HIGH → NORMAL → LOW
2. Then ETA urgency: Overdue → Due today → Future (ascending date) → No ETA
3. Then received date ascending (longest-waiting rises up within a tier)

The tickets list retains its status filter pills and search box — applying a filter overrides the default sort only in the sense that results are filtered first, then sorted the same way.

### 3. Overview Dashboard (`/dashboard`)

**Stat cards (unchanged count — 4 cards):**
- Devices in Queue — adds overdue sub-count in red below the number when > 0
- Ready for Pickup — unchanged
- Quotes Awaiting — unchanged
- Low Stock Parts — unchanged

**Overdue alert banner:**
Displayed above the queue table when at least one active ticket is overdue. Shows the count, lists the first 3 ticket codes, links to `/dashboard/tickets?eta=overdue` (future filter — can be a plain `/dashboard/tickets` link for MVP).

**Queue table:**
- Cap raised from 10 → 20 tickets
- Columns: `#` · Code · Device + Customer (merged) · Status · Tech · ETA
- ETA column with urgency states and row border colouring
- Row click opens `TicketSlideOver`

### 4. Tickets List (`/dashboard/tickets`)

**No structural changes** to filter pills or search form.

**Table columns:** Code · Device + Customer (merged) · Status · Tech · ETA · Received  
(Device and Customer merged into one column to make room for ETA — device on line 1, customer name + phone on line 2 in grey.)

**Default sort:** priority → ETA urgency → received asc (replaces current `orderBy: { createdAt: "desc" }`).

**Row click:** opens `TicketSlideOver` (same component as overview).

### 5. TicketSlideOver Component

A client component (`components/ticket-slide-over.tsx`) rendered inside a client wrapper on both pages.

**Panel sections (top to bottom):**

1. **Header** — ticket code (monospace), status badge, priority badge, ETA overdue alert if applicable. Close (✕) button.
2. **Customer strip** — name, phone. "Full ticket →" link to `/dashboard/tickets/[id]`.
3. **Move to** — buttons for each valid next status per `STATUS_FLOW[currentStatus]`. Primary button style for the most natural next step, secondary for alternatives. Submits via `changeStatus` server action.
4. **Assign** — technician `<select>` pre-set to current assignee + Save button. Submits via `assignTicket` server action.
5. **ETA** — date `<input>` pre-set to current ETA + Save button. Submits via `updateTicketDetails` server action (etaDate field only).
6. **Photos / Attachments** — thumbnail strip of existing photos (max 4, "+N more" link). Upload form: file input, kind selector (INTAKE / COMPLETION / OTHER), "Visible to customer" checkbox, Upload button. Submits via `uploadAttachment` server action.
7. **Quick note** — textarea + Post button. Submits via `addNote` server action (internal, not public by default).

**Behaviour:**
- Open: clicking a table row sets `selectedTicketId` in client state; panel slides in from the right with a CSS transition.
- Close: clicking the backdrop overlay, pressing Esc, or clicking ✕.
- After any server action: calls `router.refresh()` to sync the table row without full navigation.
- Panel stays open after individual saves (status, assign, ETA, note, attachment) so staff can do multiple actions in one visit.

**Data passed to panel from table query:**
The existing list queries already include `customer` and `assignedTo`. The panel needs: ticket fields (`id`, `code`, `status`, `priority`, `etaDate`, `brand`, `model`, `deviceType`), `customer` (`name`, `phone`), `assignedTo` (`id`, `name`), and `attachments` (thumbnail strip — add to list query).

Technician list (for assign dropdown) is fetched once at page load and passed down as a prop.

### 6. Implementation Notes

- `TicketSlideOver` is a client component. The page files stay as server components; they render a thin client wrapper (`QueueClient` / `TicketsClient`) that owns the `selectedTicketId` state and renders the table rows as `<tr onClick>`.
- `STATUS_FLOW` is already exported from `lib/constants.ts` — import it in the client component to compute next statuses without an API call.
- ETA urgency classification is a pure utility function (`lib/utils.ts: etaUrgency(date)`).
- The `uploadAttachment` server action currently expects `ticketId` as a form field — the slide-over form passes it as a hidden input.
- The `updateTicketDetails` server action also handles `laborCost`. The slide-over ETA form must pass the existing `laborCost` value as a hidden field to avoid clobbering it, OR a dedicated `updateEta` server action should be extracted. Prefer extracting `updateEta` to keep the slide-over form simple.
- No new API routes needed — all actions go through existing server actions.

---

## File Changes

| File | Change |
|---|---|
| `components/ticket-slide-over.tsx` | **New** — slide-over panel client component |
| `components/queue-client.tsx` | **New** — thin client wrapper for overview queue table |
| `components/tickets-client.tsx` | **New** — thin client wrapper for tickets list table |
| `app/dashboard/page.tsx` | Update query (add attachments, raise cap to 20, new sort), render `QueueClient`, add overdue banner + stat card sub-count |
| `app/dashboard/tickets/page.tsx` | Update query (add attachments, new sort), render `TicketsClient`, add ETA column |
| `lib/utils.ts` | Add `etaUrgency(date)` helper |
| `app/actions/tickets.ts` | Add `updateEta` server action (ticketId + etaDate only) |

---

## Out of Scope (explicit)

- Quote amount input in slide-over — the QUOTE_SENT transition needs a quote amount. For MVP, show a note "Set quote on full ticket page" and link there. A follow-up can add the input inline.
- Pagination — list caps stay at 100 (tickets) / 20 (overview). Pagination is a separate feature.
- Real-time updates — `router.refresh()` is sufficient; no WebSocket/polling.
