import { db } from "@/lib/db";
import { createPart } from "@/app/actions/inventory";
import { PartForm } from "@/components/part-form";

export default async function NewPartPage() {
  const suppliers = await db.supplier.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">New Part</h1>
      <PartForm suppliers={suppliers} action={createPart} />
    </div>
  );
}
