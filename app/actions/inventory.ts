"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";

export async function createPart(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");

  const sku = (formData.get("sku") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  if (!sku || !name) throw new Error("SKU and name are required");

  await db.part.create({
    data: {
      sku,
      name,
      category: (formData.get("category") as string) || "OTHER",
      quantity: parseInt((formData.get("quantity") as string) || "0", 10) || 0,
      lowStockThreshold: parseInt((formData.get("lowStockThreshold") as string) || "3", 10) || 3,
      costPrice: parseFloat((formData.get("costPrice") as string) || "0") || 0,
      sellPrice: parseFloat((formData.get("sellPrice") as string) || "0") || 0,
      supplierId: (formData.get("supplierId") as string) || null,
    },
  });

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

export async function updatePart(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");
  const id = formData.get("id") as string;

  await db.part.update({
    where: { id },
    data: {
      sku: (formData.get("sku") as string)?.trim(),
      name: (formData.get("name") as string)?.trim(),
      category: (formData.get("category") as string) || "OTHER",
      lowStockThreshold: parseInt((formData.get("lowStockThreshold") as string) || "3", 10) || 3,
      costPrice: parseFloat((formData.get("costPrice") as string) || "0") || 0,
      sellPrice: parseFloat((formData.get("sellPrice") as string) || "0") || 0,
      supplierId: (formData.get("supplierId") as string) || null,
    },
  });

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

// Manual stock correction (e.g. recount, damaged part)
export async function adjustStock(formData: FormData) {
  await requireUser();
  const id = formData.get("partId") as string;
  const delta = parseInt(formData.get("delta") as string, 10);
  if (!delta) return;

  await db.$transaction(async (tx) => {
    const part = await tx.part.findUniqueOrThrow({ where: { id } });
    const next = part.quantity + delta;
    if (next < 0) throw new Error("Stock cannot go below zero");
    await tx.part.update({ where: { id }, data: { quantity: next } });
  });

  revalidatePath("/dashboard/inventory");
}

export async function createSupplier(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name is required");

  await db.supplier.create({
    data: {
      name,
      phone: (formData.get("phone") as string)?.trim() || null,
      email: (formData.get("email") as string)?.trim() || null,
      notes: (formData.get("notes") as string)?.trim() || null,
    },
  });

  revalidatePath("/dashboard/suppliers");
  redirect("/dashboard/suppliers");
}

export async function createPurchaseOrder(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");
  const supplierId = formData.get("supplierId") as string;
  if (!supplierId) throw new Error("Supplier is required");

  // Items arrive as parallel arrays: partId[] / qty[] / unitCost[]
  const partIds = formData.getAll("partId") as string[];
  const qtys = formData.getAll("qty") as string[];
  const costs = formData.getAll("unitCost") as string[];

  const items = partIds
    .map((partId, i) => ({
      partId,
      quantity: parseInt(qtys[i], 10) || 0,
      unitCost: parseFloat(costs[i]) || 0,
    }))
    .filter((it) => it.partId && it.quantity > 0);

  if (items.length === 0) throw new Error("Add at least one item");

  const count = await db.purchaseOrder.count();
  const number = `PO-${String(count + 1).padStart(5, "0")}`;

  await db.purchaseOrder.create({
    data: {
      number,
      supplierId,
      notes: (formData.get("notes") as string)?.trim() || null,
      items: { create: items },
    },
  });

  revalidatePath("/dashboard/purchase-orders");
  redirect("/dashboard/purchase-orders");
}

// Receiving a PO restocks every item and updates part cost price
export async function receivePurchaseOrder(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");
  const id = formData.get("id") as string;

  await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { items: true },
    });
    if (po.status !== "PENDING") throw new Error("Order is not pending");

    for (const item of po.items) {
      await tx.part.update({
        where: { id: item.partId },
        data: {
          quantity: { increment: item.quantity },
          costPrice: item.unitCost,
        },
      });
    }

    await tx.purchaseOrder.update({
      where: { id },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
  });

  revalidatePath("/dashboard/purchase-orders");
  revalidatePath("/dashboard/inventory");
}

export async function cancelPurchaseOrder(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");
  const id = formData.get("id") as string;

  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status !== "PENDING") throw new Error("Only pending orders can be cancelled");

  await db.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/dashboard/purchase-orders");
}
