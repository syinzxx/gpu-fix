import { PART_CATEGORIES } from "@/lib/constants";
import { Button, Input, Label, Select, Card } from "@/components/ui";
import type { Part, Supplier } from "@prisma/client";

export function PartForm({
  part,
  suppliers,
  action,
}: {
  part?: Part;
  suppliers: Supplier[];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <Card className="space-y-4 p-5">
        {part && <input type="hidden" name="id" value={part.id} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sku">SKU *</Label>
            <Input id="sku" name="sku" required defaultValue={part?.sku ?? ""} placeholder="e.g. FAN-9025-12V" />
          </div>
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required defaultValue={part?.name ?? ""} placeholder="Part name" />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select id="category" name="category" defaultValue={part?.category ?? "OTHER"}>
              {PART_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="supplierId">Supplier</Label>
            <Select id="supplierId" name="supplierId" defaultValue={part?.supplierId ?? ""}>
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          {!part && (
            <div>
              <Label htmlFor="quantity">Initial stock</Label>
              <Input id="quantity" name="quantity" type="number" min="0" defaultValue="0" />
            </div>
          )}
          <div>
            <Label htmlFor="lowStockThreshold">Low-stock alert at</Label>
            <Input id="lowStockThreshold" name="lowStockThreshold" type="number" min="0" defaultValue={part?.lowStockThreshold ?? 3} />
          </div>
          <div>
            <Label htmlFor="costPrice">Cost price</Label>
            <Input id="costPrice" name="costPrice" type="number" step="0.01" min="0" defaultValue={part?.costPrice ?? 0} />
          </div>
          <div>
            <Label htmlFor="sellPrice">Sell price</Label>
            <Input id="sellPrice" name="sellPrice" type="number" step="0.01" min="0" defaultValue={part?.sellPrice ?? 0} />
          </div>
        </div>
        <Button type="submit" className="w-full">{part ? "Save changes" : "Create part"}</Button>
      </Card>
    </form>
  );
}
