"use server";

// PUBLIC server actions — invoked from the tracking page (/track/[code]),
// which has no auth. Never trust input beyond its shape, never leak staff
// names / internal ids / cost data, and treat every action as reachable by
// anyone who knows (or guesses) a ticket code.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendTicketStatusWhatsapp } from "@/lib/whatsapp";

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .transform((s) => s.toUpperCase());

const ratingSchema = z.object({
  code: codeSchema,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export async function approveQuote(formData: FormData) {
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return;
  const code = parsed.data;

  const ticket = await db.ticket.findUnique({
    where: { code },
    include: { customer: { select: { name: true, whatsapp: true } } },
  });
  // Only act from QUOTE_SENT — wrong state (or unknown code) is a silent no-op.
  if (!ticket || ticket.status !== "QUOTE_SENT") return;

  await db.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "QUOTE_APPROVED",
      events: {
        create: {
          type: "STATUS_CHANGE",
          fromStatus: ticket.status,
          toStatus: "QUOTE_APPROVED",
          isPublic: true,
          note: "Approved by customer via tracking page",
          createdById: null,
        },
      },
    },
  });

  await sendTicketStatusWhatsapp({
    ticketId: ticket.id,
    to: ticket.customer.whatsapp,
    customerName: ticket.customer.name,
    code: ticket.code,
    status: "QUOTE_APPROVED",
    device: `${ticket.brand} ${ticket.model}`,
    quoteAmount: ticket.quoteAmount,
  });

  revalidatePath(`/track/${ticket.code}`);
  revalidatePath(`/dashboard/tickets/${ticket.id}`);
}

export async function rejectQuote(formData: FormData) {
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return;
  const code = parsed.data;

  const ticket = await db.ticket.findUnique({
    where: { code },
    include: { customer: { select: { name: true, whatsapp: true } } },
  });
  if (!ticket || ticket.status !== "QUOTE_SENT") return;

  await db.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "QUOTE_REJECTED",
      events: {
        create: {
          type: "STATUS_CHANGE",
          fromStatus: ticket.status,
          toStatus: "QUOTE_REJECTED",
          isPublic: true,
          note: "Declined by customer via tracking page",
          createdById: null,
        },
      },
    },
  });

  await sendTicketStatusWhatsapp({
    ticketId: ticket.id,
    to: ticket.customer.whatsapp,
    customerName: ticket.customer.name,
    code: ticket.code,
    status: "QUOTE_REJECTED",
    device: `${ticket.brand} ${ticket.model}`,
    quoteAmount: ticket.quoteAmount,
  });

  revalidatePath(`/track/${ticket.code}`);
  revalidatePath(`/dashboard/tickets/${ticket.id}`);
}

export async function submitRating(formData: FormData) {
  const parsed = ratingSchema.safeParse({
    code: formData.get("code"),
    rating: formData.get("rating"),
    comment: (formData.get("comment") as string)?.trim() || undefined,
  });
  if (!parsed.success) return;
  const { code, rating, comment } = parsed.data;

  const ticket = await db.ticket.findUnique({
    where: { code },
    select: { id: true, status: true, ratedAt: true },
  });
  // Only once, and only after the ticket is actually closed.
  if (!ticket || ticket.status !== "CLOSED" || ticket.ratedAt) return;

  await db.ticket.update({
    where: { id: ticket.id },
    data: {
      rating,
      ratingComment: comment || null,
      ratedAt: new Date(),
    },
  });

  revalidatePath(`/track/${code}`);
  revalidatePath(`/dashboard/tickets/${ticket.id}`);
}
