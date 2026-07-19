export const ROLES = ["ADMIN", "RECEPTIONIST", "TECHNICIAN"] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "QUOTE_SENT",
  "QUOTE_APPROVED",
  "QUOTE_REJECTED",
  "IN_REPAIR",
  "READY_FOR_PICKUP",
  "CLOSED",
] as const;
export type TicketStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  QUOTE_SENT: "Quote Sent",
  QUOTE_APPROVED: "Quote Approved",
  QUOTE_REJECTED: "Quote Rejected",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready for Pickup",
  CLOSED: "Closed",
};

// Allowed transitions from each status
export const STATUS_FLOW: Record<TicketStatus, TicketStatus[]> = {
  RECEIVED: ["DIAGNOSING"],
  DIAGNOSING: ["QUOTE_SENT", "IN_REPAIR"], // small fixes may skip the quote
  QUOTE_SENT: ["QUOTE_APPROVED", "QUOTE_REJECTED"],
  QUOTE_APPROVED: ["IN_REPAIR"],
  QUOTE_REJECTED: ["READY_FOR_PICKUP", "QUOTE_SENT"], // return device, or re-quote
  IN_REPAIR: ["READY_FOR_PICKUP", "DIAGNOSING"],
  READY_FOR_PICKUP: ["CLOSED"],
  CLOSED: [],
};

// Statuses that count as "in the queue" (device still being worked on)
export const ACTIVE_STATUSES: TicketStatus[] = [
  "RECEIVED",
  "DIAGNOSING",
  "QUOTE_SENT",
  "QUOTE_APPROVED",
  "IN_REPAIR",
];

export const STATUS_COLORS: Record<TicketStatus, string> = {
  RECEIVED: "bg-slate-100 text-slate-600",
  DIAGNOSING: "bg-sky-100 text-sky-700",
  QUOTE_SENT: "bg-amber-100 text-amber-700",
  QUOTE_APPROVED: "bg-teal-100 text-teal-700",
  QUOTE_REJECTED: "bg-rose-100 text-rose-700",
  IN_REPAIR: "bg-violet-100 text-violet-700",
  READY_FOR_PICKUP: "bg-emerald-500 text-white",
  CLOSED: "bg-slate-100 text-slate-400",
};

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-500",
  NORMAL: "bg-sky-100 text-sky-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-rose-500 text-white",
};

export const DEVICE_TYPES = ["GPU", "LAPTOP", "CONSOLE", "PC", "OTHER"] as const;

export const PART_CATEGORIES = [
  "FAN",
  "VRM",
  "CAPACITOR",
  "MEMORY",
  "CONNECTOR",
  "THERMAL",
  "PCB",
  "OTHER",
] as const;

export const PAYMENT_METHODS = ["CASH", "CARD", "INSTAPAY", "WALLET"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_KINDS = ["DEPOSIT", "PAYMENT", "REFUND"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_COLORS: Record<string, string> = {
  DEPOSIT: "bg-sky-100 text-sky-700",
  PAYMENT: "bg-emerald-100 text-emerald-700",
  REFUND: "bg-rose-100 text-rose-700",
};

export const EXPENSE_CATEGORIES = [
  "RENT",
  "UTILITIES",
  "PARTS",
  "SALARIES",
  "TRANSPORT",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Message sent to the customer on each status change
export function statusMessage(opts: {
  customerName: string;
  code: string;
  status: TicketStatus;
  device: string;
  quoteAmount?: number | null;
  eta?: string | null;
}): string {
  const trackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/track/${opts.code}`;
  const shop = process.env.SHOP_NAME ?? "our shop";
  const lines: Record<TicketStatus, string> = {
    RECEIVED: `We received your ${opts.device}. Track it anytime: ${trackUrl}`,
    DIAGNOSING: `Your ${opts.device} is now being diagnosed.`,
    QUOTE_SENT: `Diagnosis complete. Repair quote: ${opts.quoteAmount ?? "-"}. Reply to approve or check ${trackUrl}`,
    QUOTE_APPROVED: `Quote approved — your ${opts.device} is queued for repair.`,
    QUOTE_REJECTED: `Quote declined. Your ${opts.device} will be prepared for return.`,
    IN_REPAIR: `Good news — your ${opts.device} is now being repaired.${opts.eta ? ` Estimated completion: ${opts.eta}.` : ""}`,
    READY_FOR_PICKUP: `Your ${opts.device} is ready for pickup! See the summary at ${trackUrl}`,
    CLOSED: `Ticket ${opts.code} is closed. Thank you for choosing ${shop}! We'd love your feedback — rate your repair experience: ${trackUrl}`,
  };
  return `Hi ${opts.customerName}, ticket ${opts.code}: ${lines[opts.status]}`;
}

/** Builds the per-status single-sentence line used in the ticket_update WhatsApp template. */
export function buildStatusLine(opts: {
  status: TicketStatus;
  device: string;
  quoteAmount?: number | null;
  eta?: string | null;
}): string {
  const { status, device, quoteAmount, eta } = opts;
  const lines: Record<TicketStatus, string> = {
    RECEIVED: `We received your ${device}`,
    DIAGNOSING: `Your ${device} is now being diagnosed`,
    QUOTE_SENT: `Diagnosis complete. Repair quote: ${quoteAmount ?? "-"}`,
    QUOTE_APPROVED: `Quote approved — your ${device} is queued for repair`,
    QUOTE_REJECTED: `Quote declined. Your ${device} will be prepared for return`,
    IN_REPAIR: `Your ${device} is now being repaired${eta ? `. ETA: ${eta}` : ""}`,
    READY_FOR_PICKUP: `Your ${device} is ready for pickup!`,
    CLOSED: `Ticket closed. Thank you for choosing us! We'd love your feedback — please rate your repair experience`,
  };
  return lines[status];
}
