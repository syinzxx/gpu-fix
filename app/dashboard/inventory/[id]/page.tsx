import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updatePart } from "@/app/actions/inventory";
import { PartForm } from "@/components/part-form";

export default async function EditPartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [part, suppliers] = await Promise.all([
    db.part.findUnique({ where: { id } }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!part) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Edit Part</h1>
        <p className="mt-1 text-sm text-slate-500">
          Current stock: <span className="font-bold">{part.quantity}</span> — adjust stock from
          the inventory list or by receiving a purchase order.
        </p>
      </div>
      <PartForm part={part} suppliers={suppliers} action={updatePart} />
    </div>
  );
}
