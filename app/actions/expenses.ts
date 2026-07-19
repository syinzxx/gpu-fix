"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

const addExpenseSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.enum(EXPENSE_CATEGORIES),
  note: z.string().trim().optional(),
  date: z.coerce.date().optional(),
});

export async function addExpense(formData: FormData) {
  const user = await requireRole("ADMIN", "RECEPTIONIST");

  const dateRaw = (formData.get("date") as string)?.trim();
  const parsed = addExpenseSchema.safeParse({
    amount: formData.get("amount"),
    category: formData.get("category"),
    note: (formData.get("note") as string)?.trim() || undefined,
    date: dateRaw || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid expense");
  }
  const { amount, category, note, date } = parsed.data;

  await db.expense.create({
    data: {
      amount,
      category,
      note: note || null,
      date: date ?? new Date(),
      createdById: user.id,
    },
  });

  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
}

export async function deleteExpense(formData: FormData) {
  await requireRole("ADMIN");
  const id = formData.get("id") as string;
  if (!id) throw new Error("Expense is required");

  await db.expense.delete({ where: { id } });

  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
}
