# GPU Fix Shop

Ticketing + inventory web app for a GPU repair shop. Customers track repairs with a ticket
code (no login); staff manage the queue, spare parts, purchase orders, and invoices.

## Quick start

```bash
npm install
npm run db:push    # create the local SQLite database
npm run db:seed    # seed staff accounts + sample parts
npm run dev        # http://localhost:3000
```

**Seeded logins** (password `admin123` for all):

| Email | Role |
|---|---|
| `admin@shop.com` | Admin — everything, incl. staff management |
| `reception@shop.com` | Receptionist — tickets, customers, inventory, invoices |
| `tech@shop.com` | Technician — repairs, notes, parts |

A demo ticket exists at [`/track/GPU-DEMO1`](http://localhost:3000/track/GPU-DEMO1).

## How it works

**Ticket workflow** — `Received → Diagnosing → Quote Sent → Approved/Rejected → In Repair →
Ready for Pickup → Closed`. Every transition is timestamped on the ticket timeline and
messaged to the customer on WhatsApp. Small fixes can skip the quote step
(Diagnosing → In Repair).

**Customer tracking** — `/track/<CODE>` is public: current status, queue position,
ETA, public technician notes, and the invoice once issued.

**Inventory** — parts with low-stock alerts; adding a part to a ticket decrements stock
(price/cost snapshotted); removing it restocks. Receiving a purchase order restocks and
updates cost price.

**Invoices** — labor + parts + discount, print-friendly (`Print / Save PDF` uses the
browser's print-to-PDF).

**WhatsApp** — sends via the Twilio WhatsApp Business API when `TWILIO_*` env vars are set.
Until then, messages are logged as *send manually* on the ticket page so staff can
copy-paste them into WhatsApp.

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite locally; a Postgres URL in production |
| `AUTH_SECRET` | Session signing key — change in production |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | Enables automated WhatsApp sending |
| `NEXT_PUBLIC_APP_URL` | Base URL used in customer tracking links |
| `SHOP_NAME` / `SHOP_PHONE` / `SHOP_ADDRESS` | Shown on invoices and messages |
| `NEXT_PUBLIC_CURRENCY` | Currency label (default `EGP`) |

## Deploying with PostgreSQL

1. In `prisma/schema.prisma`, change the datasource provider to `postgresql`.
2. Set `DATABASE_URL` to your Postgres connection string (e.g. Neon via the Vercel Marketplace).
3. `npx prisma db push && npm run db:seed`, then deploy.
