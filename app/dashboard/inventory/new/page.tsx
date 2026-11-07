import { db } from "@/lib/db";
import { createPart } from "@/app/actions/inventory";
import { PartForm } from "@/components/part-form";
import { getT } from "@/lib/locale";

export default async function NewPartPage() {
  const [suppliers, t] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    getT(),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.newPartTitle}</h1>
      <PartForm suppliers={suppliers} action={createPart} />
    </div>
  );
}
