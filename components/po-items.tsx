"use client";

import { useState } from "react";
import { Button, Input, Label, Select } from "@/components/ui";

type PartOption = { id: string; name: string; sku: string; costPrice: number };

export function PoItemRows({ parts }: { parts: PartOption[] }) {
  const [rows, setRows] = useState([0]);

  return (
    <div className="space-y-3">
      {rows.map((key, idx) => (
        <div key={key} className="flex items-end gap-2">
          <div className="flex-1">
            {idx === 0 && <Label>Part</Label>}
            <Select name="partId" required defaultValue="">
              <option value="" disabled>Select a part…</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </Select>
          </div>
          <div className="w-20">
            {idx === 0 && <Label>Qty</Label>}
            <Input name="qty" type="number" min="1" defaultValue="1" required />
          </div>
          <div className="w-28">
            {idx === 0 && <Label>Unit cost</Label>}
            <Input name="unitCost" type="number" step="0.01" min="0" defaultValue="0" required />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRows((r) => (r.length > 1 ? r.filter((k) => k !== key) : r))}
            disabled={rows.length === 1}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setRows((r) => [...r, Math.max(...r) + 1])}
      >
        + Add row
      </Button>
    </div>
  );
}
