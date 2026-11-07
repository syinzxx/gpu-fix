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

/**
 * A ticket must always have a creator, so those tickets move to the admin
 * deleting the account. Other links (assigned tickets, history entries,
 * payments) stay in place without a name, through the schema's SetNull.
 */
export async function deleteUser(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const id = formData.get("id") as string;
  if (id === admin.id) throw new Error("You cannot delete yourself");

  await db.$transaction([
    db.ticket.updateMany({ where: { createdById: id }, data: { createdById: admin.id } }),
    db.user.delete({ where: { id } }),
  ]);

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
  revalidatePath(`/dashboard/customers/${id}`);
  redirect(`/dashboard/customers/${id}`);
}

export async function saveSettings(formData: FormData) {
  await requireRole("ADMIN");

  const data = {
    shopName: (formData.get("shopName") as string)?.trim() || "GPU Fix Shop",
    shopAddress: (formData.get("shopAddress") as string)?.trim() || "",
    shopPhone: (formData.get("shopPhone") as string)?.trim() || "",
    shopHours: (formData.get("shopHours") as string)?.trim() || "",
    whatsappNumber: (formData.get("whatsappNumber") as string)?.trim() || "",
    socialFacebook: (formData.get("socialFacebook") as string)?.trim() || "",
    socialYoutube: (formData.get("socialYoutube") as string)?.trim() || "",
    socialTiktok: (formData.get("socialTiktok") as string)?.trim() || "",
    socialDiscord: (formData.get("socialDiscord") as string)?.trim() || "",
  };

  await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  redirect("/dashboard/settings");
}
