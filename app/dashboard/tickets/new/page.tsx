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
