# Ticket & Customer UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 UX improvements: warranty back-link, customer search/select in new ticket form, deposit removal, Customer Request section with work-type and colored priority, and ETA time-frame presets.

**Architecture:** The new ticket form (`app/dashboard/tickets/new/page.tsx`) becomes a thin server wrapper that passes `technicians` as props to a new `"use client"` component (`components/new-ticket-form.tsx`). The client component handles customer search (via `searchCustomers` server action), colored priority pills, and ETA preset buttons using React state and hidden inputs. The `createTicket` action gains `customerId` + `workType` support and loses deposit code. The ticket detail page gets a DB lookup to convert `warrantyTicketId` (code string) into a clickable link.

**Tech Stack:** Next.js 15 App Router, Prisma (SQLite), Tailwind CSS, React 19 `useTransition`, server actions called programmatically from client components.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `workType String?` to Ticket |
| `lib/constants.ts` | Modify | Add `WORK_TYPES`, `WORK_TYPE_LABELS`, `WorkType` |
| `app/actions/customers.ts` | Create | `searchCustomers` + `updateCustomerInline` server actions |
| `app/dashboard/tickets/new/page.tsx` | Modify | Thin server wrapper — fetches technicians, renders `<NewTicketForm>` |
| `components/new-ticket-form.tsx` | Create | Full client form: customer search, priority pills, ETA presets, work type |
| `app/actions/tickets.ts` | Modify | Accept `customerId`, add `workType`, remove deposit code |
| `app/dashboard/tickets/[id]/page.tsx` | Modify | Look up original ticket by code; render warranty link; show workType |

---

## Task 1: Schema and constants

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/constants.ts`

- [ ] **Step 1: Add `workType` to Ticket in `prisma/schema.prisma`**

Find the `Ticket` model and add `workType` after `warrantyTicketId`:

```prisma
  warrantyTicketId String?
  workType         String?  // NO_POWER | THERMAL_PASTE | THERMAL_PADS | MEMORY | FAN | EIGHT_PIN | BIOS | OTHER
```

- [ ] **Step 2: Run the migration**

```powershell
cd "C:\Users\mido_\Desktop\Fix App2\Fix App"
npx prisma migrate dev --name add_ticket_work_type
```

Expected: `The following migration(s) have been created and applied: migrations/..._add_ticket_work_type`

- [ ] **Step 3: Add WORK_TYPES to `lib/constants.ts`**

Append after the `EXPENSE_CATEGORIES` block (after line 118 in the current file):

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
  NO_POWER:      "No Power",
  THERMAL_PASTE: "Thermal Paste",
  THERMAL_PADS:  "Thermal Pads",
  MEMORY:        "Memory",
  FAN:           "Fan",
  EIGHT_PIN:     "8-pin Replacement",
  BIOS:          "BIOS / Firmware",
  OTHER:         "Other",
};
```

- [ ] **Step 4: Verify Prisma client updated**

```powershell
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations lib/constants.ts
git commit -m "feat: add workType field to Ticket schema and constants"
```

---

## Task 2: Customer server actions

**Files:**
- Create: `app/actions/customers.ts`

- [ ] **Step 1: Create `app/actions/customers.ts`**

```ts
"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

export async function updateCustomerInline(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");
  const id = formData.get("id") as string;
  if (!id) throw new Error("Customer ID required");
  await db.customer.update({
    where: { id },
    data: {
      name:     (formData.get("name")     as string)?.trim() || undefined,
      phone:    (formData.get("phone")    as string)?.trim() || undefined,
      whatsapp: (formData.get("whatsapp") as string)?.trim() || null,
      email:    (formData.get("email")    as string)?.trim() || null,
    },
  });
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
}
```

- [ ] **Step 2: Verify the file is valid TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "customers.ts"
```

Expected: no output (no errors in that file)

- [ ] **Step 3: Commit**

```powershell
git add app/actions/customers.ts
git commit -m "feat: add searchCustomers and updateCustomerInline server actions"
```

---

## Task 3: New ticket form — server wrapper + client component

**Files:**
- Modify: `app/dashboard/tickets/new/page.tsx`
- Create: `components/new-ticket-form.tsx`

- [ ] **Step 1: Rewrite `app/dashboard/tickets/new/page.tsx` as thin server wrapper**

Replace the entire file with:

```tsx
import { db } from "@/lib/db";
import { NewTicketForm } from "@/components/new-ticket-form";

export default async function NewTicketPage() {
  const technicians = await db.user.findMany({
    where: { active: true, role: { in: ["TECHNICIAN", "ADMIN"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">New Ticket</h1>
      <NewTicketForm technicians={technicians} />
    </div>
  );
}
```

- [ ] **Step 2: Create `components/new-ticket-form.tsx`**

```tsx
"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Button,
  Input,
  Label,
  Select,
  Textarea,
  Card,
  CardHeader,
} from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";
import { createTicket } from "@/app/actions/tickets";
import { searchCustomers, updateCustomerInline } from "@/app/actions/customers";
import {
  DEVICE_TYPES,
  PRIORITIES,
  PRIORITY_COLORS,
  WORK_TYPES,
  WORK_TYPE_LABELS,
} from "@/lib/constants";

type TechnicianOption = { id: string; name: string };
type CustomerResult = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
};

const ETA_PRESETS = [
  { label: "7 days",  days: 7  },
  { label: "14 days", days: 14 },
  { label: "1 month", days: 30 },
  { label: "90 days", days: 90 },
] as const;

function computeEta(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function NewTicketForm({
  technicians,
}: {
  technicians: TechnicianOption[];
}) {
  // Customer state
  const [searchQuery, setSearchQuery]           = useState("");
  const [searchResults, setSearchResults]       = useState<CustomerResult[]>([]);
  const [showDropdown, setShowDropdown]         = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [manualMode, setManualMode]             = useState(false);
  const [editMode, setEditMode]                 = useState(false);
  const [editName, setEditName]                 = useState("");
  const [editPhone, setEditPhone]               = useState("");
  const [editWhatsapp, setEditWhatsapp]         = useState("");
  const [editEmail, setEditEmail]               = useState("");

  // Ticket state
  const [priority, setPriority]   = useState("NORMAL");
  const [etaPreset, setEtaPreset] = useState<number | null>(null);

  // Transitions
  const [, startSearchTransition]              = useTransition();
  const [editPending, startEditTransition]     = useTransition();

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim().length >= 2) {
      startSearchTransition(async () => {
        const results = await searchCustomers(q);
        setSearchResults(results);
        setShowDropdown(true);
      });
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }

  function handleSelectCustomer(c: CustomerResult) {
    setSelectedCustomer(c);
    setShowDropdown(false);
    setSearchQuery("");
    setManualMode(false);
    setEditMode(false);
  }

  function openEdit() {
    setEditName(selectedCustomer!.name);
    setEditPhone(selectedCustomer!.phone);
    setEditWhatsapp(selectedCustomer!.whatsapp ?? "");
    setEditEmail(selectedCustomer!.email ?? "");
    setEditMode(true);
  }

  function handleSaveEdit() {
    startEditTransition(async () => {
      const fd = new FormData();
      fd.set("id",       selectedCustomer!.id);
      fd.set("name",     editName);
      fd.set("phone",    editPhone);
      fd.set("whatsapp", editWhatsapp);
      fd.set("email",    editEmail);
      await updateCustomerInline(fd);
      setSelectedCustomer({
        ...selectedCustomer!,
        name:     editName,
        phone:    editPhone,
        whatsapp: editWhatsapp || null,
        email:    editEmail    || null,
      });
      setEditMode(false);
    });
  }

  return (
    <form action={createTicket} className="space-y-5">
      {/* ── Customer ── */}
      <Card>
        <CardHeader
          title="Customer"
          action={
            <Link
              href="/dashboard/customers"
              className="text-xs text-violet-600 hover:underline"
            >
              View customer database →
            </Link>
          }
        />
        <div className="p-5">
          {!selectedCustomer && !manualMode ? (
            /* ─ Search mode ─ */
            <div ref={searchRef} className="relative">
              <Label htmlFor="customerSearch">Search existing customer</Label>
              <Input
                id="customerSearch"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by name or phone…"
                autoComplete="off"
              />
              {showDropdown && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">{c.name}</span>
                      <span className="text-slate-400">{c.phone}</span>
                    </button>
                  ))}
                  {searchResults.length === 0 && (
                    <p className="px-4 py-2.5 text-sm text-slate-400">
                      No customers found
                    </p>
                  )}
                  <div className="border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setManualMode(true);
                        setShowDropdown(false);
                      }}
                      className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-violet-600 hover:bg-violet-50"
                    >
                      + Create new customer
                    </button>
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Type at least 2 characters to search, or{" "}
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="text-violet-600 hover:underline"
                >
                  create new customer
                </button>
              </p>
            </div>
          ) : selectedCustomer ? (
            /* ─ Selected mode ─ */
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedCustomer.phone}
                  </p>
                  {selectedCustomer.email && (
                    <p className="text-sm text-slate-400">
                      {selectedCustomer.email}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={openEdit}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setEditMode(false);
                    }}
                  >
                    Change
                  </Button>
                </div>
              </div>
              <input
                type="hidden"
                name="customerId"
                value={selectedCustomer.id}
              />

              {editMode && (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>WhatsApp</Label>
                      <Input
                        value={editWhatsapp}
                        onChange={(e) => setEditWhatsapp(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={editPending}
                    >
                      {editPending ? "Saving…" : "Save changes"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ─ Manual entry mode ─ */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className="text-xs text-violet-600 hover:underline"
                >
                  ← Search existing customer
                </button>
              </div>
              <div>
                <Label htmlFor="customerName">Name *</Label>
                <Input
                  id="customerName"
                  name="customerName"
                  required
                  placeholder="Customer name"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  required
                  placeholder="+20 1x xxxx xxxx"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Matched by phone to existing customers
                </p>
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp (if different)</Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  placeholder="Defaults to phone"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Optional"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Device ── */}
      <Card>
        <CardHeader title="Device" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="deviceType">Type</Label>
            <Select id="deviceType" name="deviceType" defaultValue="GPU">
              {DEVICE_TYPES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="brand">Brand *</Label>
            <Input
              id="brand"
              name="brand"
              required
              placeholder="e.g. NVIDIA, ASUS"
            />
          </div>
          <div>
            <Label htmlFor="model">Model *</Label>
            <Input
              id="model"
              name="model"
              required
              placeholder="e.g. RTX 4090"
            />
          </div>
          <div>
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              name="serialNumber"
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="accessories">Accessories Received</Label>
            <Input
              id="accessories"
              name="accessories"
              placeholder="Cables, adapter, box, etc."
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="issue">Reported Issue *</Label>
            <Textarea
              id="issue"
              name="issue"
              required
              rows={3}
              placeholder="Describe what the customer reported"
            />
          </div>
        </div>
      </Card>

      {/* ── Customer Request ── */}
      <Card>
        <CardHeader title="Customer Request" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {/* Work type */}
          <div className="sm:col-span-3">
            <Label htmlFor="workType">Work Type</Label>
            <Select id="workType" name="workType" defaultValue="">
              <option value="">Select work type…</option>
              {WORK_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {WORK_TYPE_LABELS[wt]}
                </option>
              ))}
            </Select>
          </div>

          {/* Colored priority pills */}
          <div className="sm:col-span-3">
            <Label>Priority</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold ring-2 transition-all ${
                    priority === p
                      ? `${PRIORITY_COLORS[p]} ring-current`
                      : "bg-slate-100 text-slate-400 ring-transparent hover:bg-slate-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input type="hidden" name="priority" value={priority} />
          </div>

          {/* ETA presets */}
          <div className="sm:col-span-3">
            <Label>Estimated Completion</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {ETA_PRESETS.map(({ label, days }) => (
                <button
                  key={days}
                  type="button"
                  onClick={() =>
                    setEtaPreset(etaPreset === days ? null : days)
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                    etaPreset === days
                      ? "bg-violet-600 text-white ring-violet-600"
                      : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
              {etaPreset !== null && (
                <button
                  type="button"
                  onClick={() => setEtaPreset(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  × Clear
                </button>
              )}
            </div>
            {etaPreset !== null && (
              <input
                type="hidden"
                name="etaDate"
                value={computeEta(etaPreset)}
              />
            )}
          </div>

          {/* Technician */}
          <div>
            <Label htmlFor="assignedToId">Assign Technician</Label>
            <Select id="assignedToId" name="assignedToId" defaultValue="">
              <option value="">Unassigned (shared queue)</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Warranty return */}
          <div className="flex items-start gap-2 sm:col-span-3">
            <input
              type="checkbox"
              id="isWarrantyReturn"
              name="isWarrantyReturn"
              className="mt-0.5 accent-violet-600"
            />
            <div>
              <label
                htmlFor="isWarrantyReturn"
                className="cursor-pointer text-sm font-medium text-slate-700"
              >
                Warranty Return
              </label>
              <p className="text-xs text-slate-400">
                Check if this is a return within warranty period
              </p>
            </div>
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="warrantyTicketId">Original Ticket Code</Label>
            <Input
              id="warrantyTicketId"
              name="warrantyTicketId"
              placeholder="GPU-XXXXX"
            />
          </div>
        </div>
      </Card>

      {/* ── Signature ── */}
      <Card>
        <CardHeader title="Customer Signature (Optional)" />
        <div className="p-5">
          <SignaturePad />
        </div>
      </Card>

      <Button type="submit" className="w-full py-3">
        Create ticket &amp; notify customer
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```powershell
npx tsc --noEmit 2>&1 | Select-String "new-ticket-form|new/page"
```

Expected: no output (no errors in those files)

- [ ] **Step 4: Start the dev server and manually test the new form**

```powershell
npm run dev
```

Open `http://localhost:3000/dashboard/tickets/new` and verify:
- Search box shows — type 2+ chars → dropdown appears with customer results
- Selecting a customer shows read-only summary card with Edit / Change buttons
- "Edit" expands inline fields; "Save changes" updates local state and hides editor
- "Change" returns to search mode
- "← Search existing customer" link appears in manual mode
- Priority pills render with colors; clicking changes selection
- ETA preset buttons toggle; clicking same preset deselects (× Clear appears)
- Work type dropdown shows all 8 options
- "View customer database →" link opens `/dashboard/customers`

- [ ] **Step 5: Commit**

```powershell
git add app/dashboard/tickets/new/page.tsx components/new-ticket-form.tsx
git commit -m "feat: convert new ticket form to client component with customer search, priority pills, and ETA presets"
```

---

## Task 4: Update createTicket action

**Files:**
- Modify: `app/actions/tickets.ts`

This task updates `createTicket` to: (a) accept `customerId` to skip customer creation, (b) store `workType`, (c) remove all deposit code.

- [ ] **Step 1: Replace the customer resolution block and validation in `createTicket`**

Find these lines at the top of `createTicket` (approximately lines 24-46):

```ts
  const customerName = (formData.get("customerName") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const whatsapp = ((formData.get("whatsapp") as string)?.trim() || phone) ?? null;
  const brand = (formData.get("brand") as string)?.trim();
  const model = (formData.get("model") as string)?.trim();
  const issue = (formData.get("issue") as string)?.trim();

  if (!customerName || !phone || !brand || !model || !issue) {
    throw new Error("Missing required fields");
  }

  // Reuse an existing customer with the same phone number
  let customer = await db.customer.findFirst({ where: { phone } });
  if (!customer) {
    customer = await db.customer.create({
      data: {
        name: customerName,
        phone,
        whatsapp,
        email: (formData.get("email") as string)?.trim() || null,
      },
    });
  }
```

Replace with:

```ts
  const existingCustomerId = (formData.get("customerId") as string)?.trim() || null;
  const customerName = (formData.get("customerName") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const whatsapp = ((formData.get("whatsapp") as string)?.trim() || phone) ?? null;
  const brand = (formData.get("brand") as string)?.trim();
  const model = (formData.get("model") as string)?.trim();
  const issue = (formData.get("issue") as string)?.trim();

  if (!existingCustomerId && (!customerName || !phone)) {
    throw new Error("Customer name and phone are required");
  }
  if (!brand || !model || !issue) {
    throw new Error("Brand, model, and issue are required");
  }

  let customer;
  if (existingCustomerId) {
    customer = await db.customer.findUnique({ where: { id: existingCustomerId } });
    if (!customer) throw new Error("Selected customer not found");
  } else {
    customer = await db.customer.findFirst({ where: { phone: phone! } });
    if (!customer) {
      customer = await db.customer.create({
        data: {
          name: customerName!,
          phone: phone!,
          whatsapp,
          email: (formData.get("email") as string)?.trim() || null,
        },
      });
    }
  }
```

- [ ] **Step 2: Remove deposit parsing block**

Find and delete these lines (approximately lines 53-58 in the original file):

```ts
  const depositRaw = formData.get("depositAmount") as string;
  const depositAmount = depositRaw ? parseFloat(depositRaw) : 0;
  const depositMethodRaw = (formData.get("depositMethod") as string) || "CASH";
  const depositMethod: PaymentMethod = PAYMENT_METHODS.includes(depositMethodRaw as PaymentMethod)
    ? (depositMethodRaw as PaymentMethod)
    : "CASH";
```

- [ ] **Step 3: Add `workType` to the ticket create data block**

Find the `db.ticket.create` call. Inside the `data:` object, after `warrantyTicketId`, add:

```ts
      warrantyTicketId,
      workType: (formData.get("workType") as string)?.trim() || null,
      intakeSignature,
```

- [ ] **Step 4: Remove deposit Payment + TicketEvent creation block**

Find and delete this block (approximately lines 109-128 in the original file):

```ts
  if (depositAmount > 0) {
    await db.payment.create({
      data: {
        ticketId: ticket.id,
        amount: depositAmount,
        method: depositMethod,
        kind: "DEPOSIT",
        receivedById: user.id,
      },
    });
    await db.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: "PAYMENT",
        note: `Deposit recorded: ${money(depositAmount)} (${depositMethod})`,
        isPublic: false,
        createdById: user.id,
      },
    });
  }
```

- [ ] **Step 5: Clean up unused imports**

Check if `PaymentMethod` and `PAYMENT_METHODS` are still used elsewhere in the file (search for other occurrences). If they only appeared in the deposit block, remove them from the import on line 9:

Before: `import { STATUS_FLOW, PAYMENT_METHODS, type TicketStatus, type PaymentMethod } from "@/lib/constants";`

After (if unused): `import { STATUS_FLOW, type TicketStatus } from "@/lib/constants";`

If they appear in other exported functions in the file, leave them.

- [ ] **Step 6: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "tickets.ts"
```

Expected: no output

- [ ] **Step 7: Manual test — create ticket with existing customer**

In the dev server:
1. Go to `/dashboard/tickets/new`
2. Search for a customer by phone number, select them
3. Fill in device + issue fields
4. Submit — ticket should be created and redirect to the ticket detail page
5. Verify the customer on the detail page matches the one selected

- [ ] **Step 8: Manual test — create ticket with new customer**

1. Go to `/dashboard/tickets/new`
2. Click "create new customer", fill in name + phone
3. Submit — should work the same as before
4. Verify workType is stored: on the ticket detail page, the Issue card should show the work type

- [ ] **Step 9: Commit**

```powershell
git add app/actions/tickets.ts
git commit -m "feat: accept customerId and workType in createTicket, remove deposit"
```

---

## Task 5: Warranty back-link and workType display on ticket detail

**Files:**
- Modify: `app/dashboard/tickets/[id]/page.tsx`

- [ ] **Step 1: Add WORK_TYPE_LABELS import**

At the top of the file, find the constants import (currently line 6-13):

```ts
import {
  STATUS_FLOW,
  statusLabelsFor,
  ACTIVE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_KINDS,
  PAYMENT_KIND_COLORS,
  type TicketStatus,
} from "@/lib/constants";
```

Add `WORK_TYPE_LABELS` and `WorkType` to the import:

```ts
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
```

- [ ] **Step 2: Fetch the original ticket for the warranty link**

In the server component, after `if (!ticket) notFound();` (around line 60), add:

```ts
  const originalTicket =
    ticket.isWarrantyReturn && ticket.warrantyTicketId
      ? await db.ticket.findUnique({
          where: { code: ticket.warrantyTicketId },
          select: { id: true },
        })
      : null;
```

- [ ] **Step 3: Replace the plain-text warranty ref with a clickable link**

Find the current warranty ref span (around line 106-108):

```tsx
            {ticket.isWarrantyReturn && ticket.warrantyTicketId && (
              <> · <span className="text-amber-600">{t.ref} {ticket.warrantyTicketId}</span></>
            )}
```

Replace with:

```tsx
            {ticket.isWarrantyReturn && ticket.warrantyTicketId && (
              <>
                {" · "}
                {originalTicket ? (
                  <Link
                    href={`/dashboard/tickets/${originalTicket.id}`}
                    className="font-medium text-amber-600 hover:underline"
                  >
                    {t.ref} {ticket.warrantyTicketId}
                  </Link>
                ) : (
                  <span className="text-amber-600">
                    {t.ref} {ticket.warrantyTicketId}
                  </span>
                )}
              </>
            )}
```

- [ ] **Step 4: Display workType on the issue card**

Find the Issue card content (around line 177-183):

```tsx
          <Card>
            <CardHeader title={t.issue} />
            <div className="p-5 text-sm text-slate-900">
              <p className="whitespace-pre-wrap">{ticket.issue}</p>
              {ticket.accessories && (
                <p className="mt-3 text-xs text-slate-400">{t.accessories} {ticket.accessories}</p>
              )}
            </div>
          </Card>
```

Add workType display after the issue text:

```tsx
          <Card>
            <CardHeader title={t.issue} />
            <div className="p-5 text-sm text-slate-900">
              <p className="whitespace-pre-wrap">{ticket.issue}</p>
              {ticket.workType && (
                <p className="mt-2 text-xs text-slate-500">
                  Work type:{" "}
                  <span className="font-medium">
                    {WORK_TYPE_LABELS[ticket.workType as WorkType] ?? ticket.workType}
                  </span>
                </p>
              )}
              {ticket.accessories && (
                <p className="mt-3 text-xs text-slate-400">{t.accessories} {ticket.accessories}</p>
              )}
            </div>
          </Card>
```

- [ ] **Step 5: Verify TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "\[id\]"
```

Expected: no output

- [ ] **Step 6: Manual test — warranty link**

1. Create a warranty-return ticket with a valid existing ticket code in the "Original Ticket Code" field
2. Open the created ticket's detail page
3. Verify the code in the header is a clickable link (amber, underline on hover) pointing to the original ticket
4. Click it — should navigate to the original ticket
5. Create a ticket with a non-existent warranty code — verify it falls back to plain amber text (no broken link)

- [ ] **Step 7: Manual test — workType display**

1. Create a ticket with a work type selected (e.g., "Thermal Paste")
2. Open the ticket detail page
3. Verify "Work type: Thermal Paste" appears below the reported issue text

- [ ] **Step 8: Commit**

```powershell
git add app/dashboard/tickets/[id]/page.tsx
git commit -m "feat: warranty back-link and workType display on ticket detail"
```

---

## Final verification

- [ ] **Check TypeScript clean across all changed files**

```powershell
npx tsc --noEmit
```

Expected: no errors

- [ ] **End-to-end flow test**

1. Go to `/dashboard/tickets/new`
2. Search for a customer — select one
3. Click Edit — change the name — Save changes — verify summary card updates
4. Fill device info and reported issue
5. Select work type "No Power"
6. Click "URGENT" priority pill — verify it turns red
7. Click "14 days" ETA preset — verify it highlights
8. Submit — ticket created, redirects to detail page
9. Verify: customer name, work type shown, URGENT priority badge shown, ETA 14 days from today shown
10. Go back, do the same flow with "create new customer" manual entry
11. Navigate to an existing warranty-return ticket — verify original ticket link works
