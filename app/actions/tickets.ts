"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/auth";
import { generateTicketCode, money } from "@/lib/utils";
import { fmtDate } from "@/lib/utils";
import { STATUS_FLOW, PAYMENT_METHODS, type TicketStatus, type PaymentMethod } from "@/lib/constants";
import { sendTicketStatusWhatsapp } from "@/lib/whatsapp";

async function uniqueTicketCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateTicketCode();
    const exists = await db.ticket.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique ticket code");
}

export async function createTicket(formData: FormData) {
  const user = await requireUser();

  const customerName = (formData.get("customerName") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const whatsapp = ((formData.get("whatsapp") as string)?.trim() || phone) ?? null;
  const brand = (formData.get("brand") as string)?.trim();
  const model = (formData.get("model") as string)?.trim();
  const issue = (formData.get("issue") as string)?.trim();

  if (!customerName || !phone || !brand || !model || !issue) {
    throw new Error("Missing required fields");
  }

  // Reuse an existing customer with the same phone number
  let customer = await db.customer.findFirst({ where: { phone } });
  if (!customer) {
    customer = await db.customer.create({
      data: {
        name: customerName,
        phone,
        whatsapp,
        email: (formData.get("email") as string)?.trim() || null,
      },
    });
  }

  const code = await uniqueTicketCode();
  const etaRaw = formData.get("etaDate") as string;
  const isWarrantyReturn = formData.get("isWarrantyReturn") === "on";
  const warrantyTicketId = (formData.get("warrantyTicketId") as string)?.trim() || null;

  const depositRaw = formData.get("depositAmount") as string;
  const depositAmount = depositRaw ? parseFloat(depositRaw) : 0;
  const depositMethodRaw = (formData.get("depositMethod") as string) || "CASH";
  const depositMethod: PaymentMethod = PAYMENT_METHODS.includes(depositMethodRaw as PaymentMethod)
    ? (depositMethodRaw as PaymentMethod)
    : "CASH";

  const signatureRaw = (formData.get("intakeSignature") as string) || "";
  const intakeSignature =
    signatureRaw.startsWith("data:image/png;base64,") && signatureRaw.length < 200_000
      ? signatureRaw
      : null;

  const ticket = await db.ticket.create({
    data: {
      code,
      customerId: customer.id,
      deviceType: (formData.get("deviceType") as string) || "GPU",
      brand,
      model,
      serialNumber: (formData.get("serialNumber") as string)?.trim() || null,
      accessories: (formData.get("accessories") as string)?.trim() || null,
      issue,
      priority: (formData.get("priority") as string) || "NORMAL",
      etaDate: etaRaw ? new Date(etaRaw) : null,
      assignedToId: (formData.get("assignedToId") as string) || null,
      isWarrantyReturn,
      warrantyTicketId,
      intakeSignature,
      createdById: user.id,
      events: {
        create: {
          type: "CREATED",
          toStatus: "RECEIVED",
          isPublic: true,
          createdById: user.id,
        },
      },
    },
  });

  const checklistTemplates = await db.checklistTemplate.findMany({
    where: { deviceType: ticket.deviceType },
    orderBy: [{ phase: "asc" }, { sortOrder: "asc" }],
  });
  if (checklistTemplates.length > 0) {
    await db.ticketChecklistItem.createMany({
      data: checklistTemplates.map((t) => ({
        ticketId: ticket.id,
        phase: t.phase,
        label: t.label,
        sortOrder: t.sortOrder,
      })),
    });
  }

  if (depositAmount > 0) {
    await db.payment.create({
      data: {
        ticketId: ticket.id,
        amount: depositAmount,
        method: depositMethod,
        kind: "DEPOSIT",
        receivedById: user.id,
      },
    });
    await db.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: "PAYMENT",
        note: `Deposit recorded: ${money(depositAmount)} (${depositMethod})`,
        isPublic: false,
        createdById: user.id,
      },
    });
  }

  await sendTicketStatusWhatsapp({
    ticketId: ticket.id,
    to: customer.whatsapp,
    customerName: customer.name,
    code: ticket.code,
    status: "RECEIVED",
    device: `${brand} ${model}`,
  });

  revalidatePath("/dashboard/tickets");
  redirect(`/dashboard/tickets/${ticket.id}`);
}

export async function changeStatus(formData: FormData) {
  const user = await requireUser();
  const ticketId = formData.get("ticketId") as string;
  const toStatus = formData.get("toStatus") as TicketStatus;
  const quoteRaw = formData.get("quoteAmount") as string | null;

  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { customer: true },
  });

  const allowed = STATUS_FLOW[ticket.status as TicketStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new Error(`Cannot move from ${ticket.status} to ${toStatus}`);
  }

  if (toStatus === "QUOTE_SENT" && (!quoteRaw || isNaN(parseFloat(quoteRaw)))) {
    throw new Error("A quote amount is required to send a quote");
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      status: toStatus,
      quoteAmount: toStatus === "QUOTE_SENT" ? parseFloat(quoteRaw!) : undefined,
      closedAt: toStatus === "CLOSED" ? new Date() : undefined,
      events: {
        create: {
          type: "STATUS_CHANGE",
          fromStatus: ticket.status,
          toStatus,
          isPublic: true,
          createdById: user.id,
        },
      },
    },
  });

  const changeStatusQuoteAmount = toStatus === "QUOTE_SENT" ? parseFloat(quoteRaw!) : ticket.quoteAmount;
  const changeStatusEta = ticket.etaDate ? fmtDate(ticket.etaDate) : null;
  await sendTicketStatusWhatsapp({
    ticketId,
    to: ticket.customer.whatsapp,
    customerName: ticket.customer.name,
    code: ticket.code,
    status: toStatus,
    device: `${ticket.brand} ${ticket.model}`,
    quoteAmount: changeStatusQuoteAmount,
    eta: changeStatusEta,
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard");
}

export async function addNote(formData: FormData) {
  const user = await requireUser();
  const ticketId = formData.get("ticketId") as string;
  const note = (formData.get("note") as string)?.trim();
  const isPublic = formData.get("isPublic") === "on";
  if (!note) return;

  await db.ticketEvent.create({
    data: { ticketId, type: "NOTE", note, isPublic, createdById: user.id },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
}

export async function assignTicket(formData: FormData) {
  const user = await requireUser();
  const ticketId = formData.get("ticketId") as string;
  const assignedToId = (formData.get("assignedToId") as string) || null;

  const tech = assignedToId
    ? await db.user.findUnique({ where: { id: assignedToId } })
    : null;

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      assignedToId,
      events: {
        create: {
          type: "ASSIGNMENT",
          note: tech ? `Assigned to ${tech.name}` : "Unassigned",
          isPublic: false,
          createdById: user.id,
        },
      },
    },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/tickets");
}

export async function updateTicketDetails(formData: FormData) {
  await requireUser();
  const ticketId = formData.get("ticketId") as string;
  const etaRaw = formData.get("etaDate") as string;
  const laborRaw = formData.get("laborCost") as string;

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      etaDate: etaRaw ? new Date(etaRaw) : null,
      laborCost: laborRaw ? parseFloat(laborRaw) : 0,
    },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
}

export async function addPartToTicket(formData: FormData) {
  await requireUser();
  const ticketId = formData.get("ticketId") as string;
  const partId = formData.get("partId") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);

  if (!partId || !quantity || quantity < 1) throw new Error("Invalid part or quantity");

  await db.$transaction(async (tx) => {
    const part = await tx.part.findUniqueOrThrow({ where: { id: partId } });
    if (part.quantity < quantity) {
      throw new Error(`Insufficient stock for ${part.name}: ${part.quantity} left`);
    }
    await tx.part.update({
      where: { id: partId },
      data: { quantity: { decrement: quantity } },
    });
    await tx.ticketPart.create({
      data: {
        ticketId,
        partId,
        quantity,
        unitPrice: part.sellPrice,
        unitCost: part.costPrice,
      },
    });
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/inventory");
}

export async function removePartFromTicket(formData: FormData) {
  await requireUser();
  const ticketPartId = formData.get("ticketPartId") as string;

  await db.$transaction(async (tx) => {
    const tp = await tx.ticketPart.findUniqueOrThrow({ where: { id: ticketPartId } });
    await tx.part.update({
      where: { id: tp.partId },
      data: { quantity: { increment: tp.quantity } },
    });
    await tx.ticketPart.delete({ where: { id: ticketPartId } });
    revalidatePath(`/dashboard/tickets/${tp.ticketId}`);
  });

  revalidatePath("/dashboard/inventory");
}

export async function resendWhatsapp(formData: FormData) {
  await requireUser();
  const ticketId = formData.get("ticketId") as string;

  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { customer: true },
  });

  const resendEta = ticket.etaDate ? fmtDate(ticket.etaDate) : null;
  await sendTicketStatusWhatsapp({
    ticketId,
    to: ticket.customer.whatsapp,
    customerName: ticket.customer.name,
    code: ticket.code,
    status: ticket.status as TicketStatus,
    device: `${ticket.brand} ${ticket.model}`,
    quoteAmount: ticket.quoteAmount,
    eta: resendEta,
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
}

export async function setWarranty(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");
  const ticketId = formData.get("ticketId") as string;
  const raw = formData.get("warrantyDays") as string;
  const warrantyDays = raw ? parseInt(raw, 10) : null;

  await db.ticket.update({
    where: { id: ticketId },
    data: { warrantyDays: warrantyDays && !isNaN(warrantyDays) ? warrantyDays : null },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
}

export async function createInvoice(formData: FormData) {
  await requireRole("ADMIN", "RECEPTIONIST");
  const ticketId = formData.get("ticketId") as string;
  const discount = parseFloat((formData.get("discount") as string) || "0") || 0;

  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { partsUsed: true, invoice: true },
  });
  if (ticket.invoice) throw new Error("Invoice already exists for this ticket");

  const partsAmount = ticket.partsUsed.reduce((s, p) => s + p.unitPrice * p.quantity, 0);
  const total = Math.max(0, ticket.laborCost + partsAmount - discount);

  const count = await db.invoice.count();
  const number = `INV-${String(count + 1).padStart(5, "0")}`;

  await db.invoice.create({
    data: {
      number,
      ticketId,
      laborAmount: ticket.laborCost,
      partsAmount,
      discount,
      total,
    },
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
}
