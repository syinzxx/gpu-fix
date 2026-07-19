# Feature Roadmap — GPU Fix Shop

Compiled 2026-07-17 from a competitive survey of the leading repair-shop platforms
(RepairShopr, RepairDesk, Orderry, Fixably, RepairQ, Fixitize, BytePhase, RepairFlow)
mapped against what this app already has.

**Already covered by the app** (skip — these are table stakes we have): ticket workflow
with timeline + public/private notes, public tracking page, priorities, ETAs, technician
assignment, inventory with low-stock alerts + price/cost snapshots, purchase orders with
receive-restock, suppliers, invoices with print-to-PDF, WhatsApp status notifications
(Meta Cloud API + manual fallback), roles (Admin/Receptionist/Technician), basic reports,
warranty fields on Ticket (`warrantyDays`, `isWarrantyReturn`, `warrantyTicketId`).

---

## Phase 1 — Quick wins (high impact, small schema changes)

### 1.1 Payments & deposits
Every competitor has this; we invoice but never record money received.
- Record a **deposit at intake** (common for GPU repairs: diagnosis fee up front).
- **Partial payments** against an invoice; balance due shown on invoice + tracking page.
- Payment methods: cash, card, InstaPay, Vodafone Cash (Egypt-relevant).
- New `Payment` model: `ticketId/invoiceId, amount, method, receivedById, createdAt`.
- Daily cash report (see 1.6).

### 1.2 Online quote approval + digital signature
RepairShopr's portal lets customers approve/decline estimates with one click — we already
show the quote on `/track/<code>`, so this is a small step:
- Approve / Decline buttons on the tracking page → sets `QUOTE_APPROVED/REJECTED`,
  logs a timeline event with IP/timestamp, notifies staff.
- Optional drawn signature at drop-off (canvas) stored on the ticket — protects the shop
  in disputes ("you scratched my card").

### 1.3 Device intake photos & condition report
Orderry/Fixitize record device condition with photos at check-in.
- Upload photos at intake (damage, missing screws, tamper stickers) + on completion.
- `Attachment` model: `ticketId, path, kind (INTAKE|COMPLETION|OTHER), createdAt`.
- Shown on the ticket page; intake photos optionally public on the tracking page.

### 1.4 Pre/post-repair checklists
RepairDesk's signature feature. Per-device-type templates:
- GPU: fans spin, no artifacts, memtest pass, thermals under load, ports OK.
- PC/Laptop: POST, battery health, keyboard, ports. Phone: cameras, mic, speaker, touch.
- `ChecklistTemplate` (per deviceType) + `TicketChecklistItem` (checked, by, at).
- Post-repair checklist printed on the invoice = customer confidence.

### 1.5 Barcode / QR labels
- Ticket label (printable small format): code + QR linking to `/track/<code>` — stick it
  on the device bag/box.
- Part SKU barcodes; scan (USB scanner = keyboard input) to find parts fast.

### 1.6 Expenses + daily cash summary
- Simple `Expense` model (`amount, category, note, date`) so reports show real profit,
  not just invoice totals.
- End-of-day summary: payments in by method, expenses out, net (a lightweight Z-report).

### 1.7 Post-repair feedback
- After CLOSED, WhatsApp message asks for a 1–5 rating (reply or tracking-page widget).
- `rating` + `ratingComment` on Ticket; average per technician in reports.

---

## Phase 2 — Revenue features (retail & warranty)

### 2.1 Over-the-counter POS sales
All competitors bundle a POS. Sell parts/accessories (thermal paste, cables, used cards)
without a repair ticket:
- `Sale` + `SaleItem` models; decrements stock, prints receipt, records payment.
- Shift/cash-drawer sessions roll into the daily summary from 1.6.

### 2.2 Estimates as first-class documents
- Printable/WhatsApp-able quote PDF with line items (parts + labor) before approval;
  today `quoteAmount` is a single number.
- One click converts an approved estimate's lines into the ticket's parts/labor.

### 2.3 Trade-in / buyback + refurb resale
Big in the GPU niche (used mining cards): RepairDesk has device buyback built in.
- Buy a used device: record serial, condition grade, price paid → enters a
  **refurb pipeline** (test → repair → grade → list for sale).
- Sell with shop warranty; serialized so history follows the card.
- `Device` model (serialized asset) — also enables 2.4 and repeat-repair history.

### 2.4 Device registry & repair history
Orderry/Fixably track devices as assets across visits:
- `Device`: serial/IMEI, type, brand, model, owner → tickets link to a device.
- "This card was here 3 months ago for the same VRM fault" — instant warranty context.

### 2.5 Warranty end-to-end
Fields exist but the flow is manual:
- Warranty expiry auto-computed and shown on invoice + tracking page.
- "Create warranty claim" button on an old ticket → new linked ticket
  (uses existing `warrantyTicketId`), flagged so labor/parts default to 0.
- Supplier warranty on parts: track defective-part returns to suppliers.

### 2.6 Store credit & loyalty
- `creditBalance` on Customer (refunds → credit, credit → pay invoices).
- Simple loyalty: points per EGP spent, redeemable as discount.

---

## Phase 3 — Scale & automation

### 3.1 Appointment booking
Public booking page (Zenbooker-style): customer picks a service + time slot →
creates a draft ticket; calendar view for staff.

### 3.2 Mail-in repairs
Fixably's specialty. Ticket gets shipping legs (inbound/outbound), courier + tracking
number fields (Bosta/Aramex/Mylerz for Egypt), statuses shown on the tracking page.

### 3.3 Two-way WhatsApp inbox
Webhook route already exists (`app/api/whatsapp`). Store inbound replies, show a chat
thread per ticket, staff reply from the ticket page. RepairDesk calls this the
"unified inbox" — huge for a WhatsApp-first market.

### 3.4 Technician commissions & time tracking
Orderry-style: commission rules (% of labor / flat per repair), time log per ticket,
monthly payout report per technician.

### 3.5 Stocktakes & serialized inventory
Stock-count sessions with variance report; GRN records on PO receive; adjustment audit
trail (who changed stock and why).

### 3.6 Marketing automation
RepairShopr's claim to fame: automated win-back ("it's been 6 months since your last
service"), bulk WhatsApp template campaigns, filterable customer segments.

### 3.7 Accounting & tax
VAT setting applied to invoices; CSV export of invoices/payments/expenses for an
accountant; optional QuickBooks/Xero format.

### 3.8 Multi-location (only if a second branch opens)
Location on stock/tickets/users, inter-branch stock transfer. Defer until real.

---

## GPU-niche differentiators (no competitor has these)

- **Diagnostic bench results on the ticket**: structured fields for stress-test score
  (FurMark/3DMark), temps before/after repair, fan RPM — rendered as a before/after
  card on the public tracking page. Strong trust signal, great marketing.
- **Component-level repair log**: which VRM phase / memory chip was replaced — the part
  categories (VRM, MEMORY, CAPACITOR, PCB) already exist and can anchor this.
- **VBIOS version + mining-history notes** on the device registry (2.4).

## Suggested build order

Phase 1 items are independent and each is a day-or-less of work: **1.1 → 1.2 → 1.3 →
1.4 → 1.5 → 1.6 → 1.7**. Then 2.2 (estimates) → 2.1 (POS) → 2.4 (device registry,
unlocks 2.3 + 2.5). Phase 3 on demand.

## Sources

- https://www.repairshopr.com/features — CRM, marketing automation, customer portal, recurring invoices
- https://www.repairdesk.co/features/ — ticketing, checklists, signatures, POS, buyback widget, unified inbox
- https://orderry.com/repair-shop-software/ — commissions, device history, returns/refunds, AI
- https://www.fixably.com/features/repair-order-management — mail-in logistics, queue management
- https://fixitize.com/cell-phone-repair-shop-software/ — intake photos, IMEI, quote → job conversion
- https://bytephase.com/blog/what-are-the-best-repair-ticket-software-options-for-small-businesses/ — self check-in kiosk, WhatsApp flows
- https://zenbooker.com/phone-repair-scheduling-software — online booking
- https://www.g2.com/categories/repair-shop — category overview
