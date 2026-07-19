"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function toggleChecklistItem(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id") as string;

  const item = await db.ticketChecklistItem.findUniqueOrThrow({ where: { id } });
  const nextChecked = !item.checked;

  await db.ticketChecklistItem.update({
    where: { id },
    data: {
      checked: nextChecked,
      checkedById: nextChecked ? user.id : null,
      checkedAt: nextChecked ? new Date() : null,
    },
  });

  revalidatePath(`/dashboard/tickets/${item.ticketId}`);
}

// For tickets created before this feature (or whose device type had no
// templates at creation time): copy the current templates onto the ticket.
export async function loadChecklist(formData: FormData) {
  await requireUser();
  const ticketId = formData.get("ticketId") as string;

  const [ticket, existingCount] = await Promise.all([
    db.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { deviceType: true } }),
    db.ticketChecklistItem.count({ where: { ticketId } }),
  ]);
  if (existingCount > 0) return;

  const templates = await db.checklistTemplate.findMany({
    where: { deviceType: ticket.deviceType },
    orderBy: [{ phase: "asc" }, { sortOrder: "asc" }],
  });

  if (templates.length > 0) {
    await db.ticketChecklistItem.createMany({
      data: templates.map((t) => ({
        ticketId,
        phase: t.phase,
        label: t.label,
        sortOrder: t.sortOrder,
      })),
    });
  }

  revalidatePath(`/dashboard/tickets/${ticketId}`);
}
