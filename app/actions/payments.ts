"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { money } from "@/lib/utils";
import { PAYMENT_METHODS, PAYMENT_KINDS } from "@/lib/constants";

const recordPaymentSchema = z.object({
  ticketId: z.string().min(1, "Ticket is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.enum(PAYMENT_METHODS),
  kind: z.enum(PAYMENT_KINDS),
  note: z.string().trim().optional(),
});

const KIND_VERB: Record<string, string> = {
  DEPOSIT: "Deposit",
  PAYMENT: "Payment",
  REFUND: "Refund",
};

export async function recordPayment(formData: FormData) {
  const user = await requireUser();

  const parsed = recordPaymentSchema.safeParse({
    ticketId: formData.get("ticketId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    kind: formData.get("kind"),
    note: (formData.get("note") as string)?.trim() || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid payment");
  }
  const { ticketId, amount, method, kind, note } = parsed.data;

  await db.payment.create({
    data: {
      ticketId,
      amount,
      method,
      kind,
      note: note || null,
      receivedById: user.id,
    },
  });

  await db.ticketEvent.create({
    data: {
      ticketId,
      type: "PAYMENT",
      note: `${KIND_VERB[kind]} recorded: ${money(amount)} (${method})`,
      isPublic: false,
      createdById: user.id,
    },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
}

export async function deleteVoidPayment(formData: FormData) {
  await requireRole("ADMIN");
  const id = formData.get("id") as string;
  if (!id) throw new Error("Payment is required");

  const payment = await db.payment.findUniqueOrThrow({ where: { id } });
  await db.payment.delete({ where: { id } });

  revalidatePath(`/dashboard/tickets/${payment.ticketId}`);
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
}
