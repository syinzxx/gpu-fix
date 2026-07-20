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
  const [, startSearchTransition]          = useTransition();
  const [editPending, startEditTransition] = useTransition();

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
