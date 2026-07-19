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
