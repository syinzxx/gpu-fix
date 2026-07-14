"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function createUser(formData: FormData) {
  await requireRole("ADMIN");

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const role = (formData.get("role") as string) || "TECHNICIAN";

  if (!name || !email || !password || password.length < 6) {
    throw new Error("Name, email and a password of 6+ characters are required");
  }

  await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10), role },
  });

  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}

export async function toggleUserActive(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = formData.get("id") as string;
  if (id === admin.id) throw new Error("You cannot deactivate yourself");

  const user = await db.user.findUniqueOrThrow({ where: { id } });
  await db.user.update({ where: { id }, data: { active: !user.active } });

  revalidatePath("/dashboard/users");
}

export async function updateCustomer(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");
  const id = formData.get("id") as string;

  await db.customer.update({
    where: { id },
    data: {
      name: (formData.get("name") as string)?.trim(),
      phone: (formData.get("phone") as string)?.trim(),
      whatsapp: (formData.get("whatsapp") as string)?.trim() || null,
      email: (formData.get("email") as string)?.trim() || null,
      notes: (formData.get("notes") as string)?.trim() || null,
    },
  });

  revalidatePath("/dashboard/customers");
  redirect("/dashboard/customers");
}
