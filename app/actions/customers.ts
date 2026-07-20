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
