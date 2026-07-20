export const ROLES = ["ADMIN", "RECEPTIONIST", "TECHNICIAN"] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "EXPEDITE_DIAGNOSIS",
  "WAITING_FOR_PARTS",
  "TESTING",
  "WAITING_FOR_QUOTE_APPROVAL",
  "READY_FOR_PICKUP",
  "CLOSED",
] as const;
export type TicketStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  EXPEDITE_DIAGNOSIS: "Expedite Diagnosis",
  WAITING_FOR_PARTS: "Waiting for Parts",
  TESTING: "Testing",
  WAITING_FOR_QUOTE_APPROVAL: "Waiting for Quote Approval",
  READY_FOR_PICKUP: "Ready for Pickup",
  CLOSED: "Closed",
};

// Arabic status labels (lifted from app/track/[code]/page.tsx so other pages can reuse it)
export const STATUS_LABELS_AR: Record<TicketStatus, string> = {
  RECEIVED: "مستلم",
  DIAGNOSING: "قيد التشخيص",
  EXPEDITE_DIAGNOSIS: "تشخيص سريع",
  WAITING_FOR_PARTS: "بانتظار القطع",
  TESTING: "قيد الاختبار",
  WAITING_FOR_QUOTE_APPROVAL: "بانتظار موافقة العميل",
  READY_FOR_PICKUP: "جاهز للاستلام",
  CLOSED: "مغلق",
};

export function statusLabelsFor(locale: string): Record<TicketStatus, string> {
  return locale === "ar" ? STATUS_LABELS_AR : STATUS_LABELS;
}

// Allowed transitions from each status
export const STATUS_FLOW: Record<TicketStatus, TicketStatus[]> = {
  RECEIVED: ["DIAGNOSING", "EXPEDITE_DIAGNOSIS"],
  DIAGNOSING: ["EXPEDITE_DIAGNOSIS", "WAITING_FOR_PARTS", "TESTING", "WAITING_FOR_QUOTE_APPROVAL", "READY_FOR_PICKUP"],
  EXPEDITE_DIAGNOSIS: ["WAITING_FOR_PARTS", "TESTING", "WAITING_FOR_QUOTE_APPROVAL", "READY_FOR_PICKUP"],
  WAITING_FOR_PARTS: ["DIAGNOSING", "TESTING", "WAITING_FOR_QUOTE_APPROVAL", "READY_FOR_PICKUP"],
  TESTING: ["DIAGNOSING", "WAITING_FOR_PARTS", "WAITING_FOR_QUOTE_APPROVAL", "READY_FOR_PICKUP"],
  WAITING_FOR_QUOTE_APPROVAL: ["DIAGNOSING", "READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["CLOSED"],
  CLOSED: [],
};

// Statuses that count as "in the queue" (device still being worked on)
export const ACTIVE_STATUSES: TicketStatus[] = [
  "RECEIVED",
  "DIAGNOSING",
  "EXPEDITE_DIAGNOSIS",
  "WAITING_FOR_PARTS",
  "TESTING",
  "WAITING_FOR_QUOTE_APPROVAL",
];

export const STATUS_COLORS: Record<TicketStatus, string> = {
  RECEIVED: "bg-slate-100 text-slate-600",
  DIAGNOSING: "bg-sky-100 text-sky-700",
  EXPEDITE_DIAGNOSIS: "bg-orange-100 text-orange-700",
  WAITING_FOR_PARTS: "bg-indigo-100 text-indigo-700",
  TESTING: "bg-teal-100 text-teal-700",
  WAITING_FOR_QUOTE_APPROVAL: "bg-amber-100 text-amber-700",
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
    EXPEDITE_DIAGNOSIS: `Your ${opts.device} has been prioritised for fast diagnosis.`,
    WAITING_FOR_PARTS: `Parts have been ordered for your ${opts.device}. We'll update you when they arrive.`,
    TESTING: `Your ${opts.device} is in final testing.${opts.eta ? ` Expected completion: ${opts.eta}.` : ""}`,
    WAITING_FOR_QUOTE_APPROVAL: `Diagnosis complete. Repair quote: ${opts.quoteAmount ?? "-"}. Please approve or contact us. Track at ${trackUrl}`,
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
    EXPEDITE_DIAGNOSIS: `Your ${device} has been prioritised for fast diagnosis`,
    WAITING_FOR_PARTS: `Parts ordered for your ${device}`,
    TESTING: `Your ${device} is in final testing${eta ? `. ETA: ${eta}` : ""}`,
    WAITING_FOR_QUOTE_APPROVAL: `Diagnosis complete. Repair quote: ${quoteAmount ?? "-"}`,
    READY_FOR_PICKUP: `Your ${device} is ready for pickup!`,
    CLOSED: `Ticket closed. Thank you for choosing us! We'd love your feedback — please rate your repair experience`,
  };
  return lines[status];
}

export const WORK_TYPES = [
  "NO_POWER",
  "THERMAL_PASTE",
  "THERMAL_PADS",
  "MEMORY",
  "FAN",
  "EIGHT_PIN",
  "BIOS",
  "OTHER",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  NO_POWER:      "No Power",
  THERMAL_PASTE: "Thermal Paste",
  THERMAL_PADS:  "Thermal Pads",
  MEMORY:        "Memory",
  FAN:           "Fan",
  EIGHT_PIN:     "8-pin Replacement",
  BIOS:          "BIOS / Firmware",
  OTHER:         "Other",
};

// ---------------------------------------------------------------------------
// Dual-layer status system
// ---------------------------------------------------------------------------

export const STAFF_STATUSES = ["OPEN", "PENDING", "CLOSED"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  OPEN:    "Open",
  PENDING: "Pending",
  CLOSED:  "Closed",
};

export const STAFF_STATUS_COLORS: Record<StaffStatus, string> = {
  OPEN:    "bg-blue-100 text-blue-700",
  PENDING: "bg-amber-100 text-amber-700",
  CLOSED:  "bg-slate-100 text-slate-400",
};

export const CUSTOMER_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "WAITING_FOR_PARTS",
  "IN_REPAIR",
  "TESTING",
  "WAITING_FOR_APPROVAL",
  "READY_FOR_PICKUP",
  "CLOSED",
  "CANCELLED",
] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  RECEIVED:             "Received",
  DIAGNOSING:           "Diagnosing",
  WAITING_FOR_PARTS:    "Waiting for Parts",
  IN_REPAIR:            "Under Repair",
  TESTING:              "Testing",
  WAITING_FOR_APPROVAL: "Awaiting Your Approval",
  READY_FOR_PICKUP:     "Ready for Pickup",
  CLOSED:               "Closed",
  CANCELLED:            "Cancelled",
};

export const CUSTOMER_STATUS_LABELS_AR: Record<CustomerStatus, string> = {
  RECEIVED:             "مستلم",
  DIAGNOSING:           "قيد التشخيص",
  WAITING_FOR_PARTS:    "بانتظار القطع",
  IN_REPAIR:            "قيد الإصلاح",
  TESTING:              "قيد الاختبار",
  WAITING_FOR_APPROVAL: "بانتظار موافقتك",
  READY_FOR_PICKUP:     "جاهز للاستلام",
  CLOSED:               "مغلق",
  CANCELLED:            "ملغي",
};

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, string> = {
  RECEIVED:             "bg-slate-100 text-slate-600",
  DIAGNOSING:           "bg-sky-100 text-sky-700",
  WAITING_FOR_PARTS:    "bg-indigo-100 text-indigo-700",
  IN_REPAIR:            "bg-violet-100 text-violet-700",
  TESTING:              "bg-teal-100 text-teal-700",
  WAITING_FOR_APPROVAL: "bg-amber-100 text-amber-700",
  READY_FOR_PICKUP:     "bg-emerald-500 text-white",
  CLOSED:               "bg-slate-100 text-slate-400",
  CANCELLED:            "bg-rose-100 text-rose-500",
};

export const CUSTOMER_TO_STAFF_STATUS: Record<CustomerStatus, StaffStatus> = {
  RECEIVED:             "OPEN",
  DIAGNOSING:           "OPEN",
  WAITING_FOR_PARTS:    "PENDING",
  IN_REPAIR:            "OPEN",
  TESTING:              "OPEN",
  WAITING_FOR_APPROVAL: "PENDING",
  READY_FOR_PICKUP:     "PENDING",
  CLOSED:               "CLOSED",
  CANCELLED:            "CLOSED",
};

export function customerStatusLabelsFor(locale: string): Record<CustomerStatus, string> {
  return locale === "ar" ? CUSTOMER_STATUS_LABELS_AR : CUSTOMER_STATUS_LABELS;
}

export function customerStatusMessage(opts: {
  customerName: string;
  code: string;
  status: CustomerStatus;
  device: string;
  quoteAmount?: number | null;
  eta?: string | null;
}): string {
  const trackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/track/${opts.code}`;
  const shop = process.env.SHOP_NAME ?? "our shop";
  const lines: Record<CustomerStatus, string> = {
    RECEIVED:             `We received your ${opts.device}. Track it anytime: ${trackUrl}`,
    DIAGNOSING:           `Your ${opts.device} is now being diagnosed.`,
    WAITING_FOR_PARTS:    `Parts have been ordered for your ${opts.device}. We'll update you when they arrive.`,
    IN_REPAIR:            `Your ${opts.device} is now being repaired.`,
    TESTING:              `Your ${opts.device} is in final testing.${opts.eta ? ` Expected completion: ${opts.eta}.` : ""}`,
    WAITING_FOR_APPROVAL: `Diagnosis complete. Repair quote: ${opts.quoteAmount ?? "-"}. Please approve or contact us. Track at ${trackUrl}`,
    READY_FOR_PICKUP:     `Your ${opts.device} is ready for pickup! See the summary at ${trackUrl}`,
    CLOSED:               `Ticket ${opts.code} is closed. Thank you for choosing ${shop}! Rate your experience: ${trackUrl}`,
    CANCELLED:            `Ticket ${opts.code} has been cancelled. Contact us if you have questions.`,
  };
  return `Hi ${opts.customerName}, ticket ${opts.code}: ${lines[opts.status]}`;
}

export function buildCustomerStatusLine(opts: {
  status: CustomerStatus;
  device: string;
  quoteAmount?: number | null;
  eta?: string | null;
}): string {
  const { status, device, quoteAmount, eta } = opts;
  const lines: Record<CustomerStatus, string> = {
    RECEIVED:             `We received your ${device}`,
    DIAGNOSING:           `Your ${device} is now being diagnosed`,
    WAITING_FOR_PARTS:    `Parts ordered for your ${device}`,
    IN_REPAIR:            `Your ${device} is now being repaired`,
    TESTING:              `Your ${device} is in final testing${eta ? `. ETA: ${eta}` : ""}`,
    WAITING_FOR_APPROVAL: `Diagnosis complete. Repair quote: ${quoteAmount ?? "-"}`,
    READY_FOR_PICKUP:     `Your ${device} is ready for pickup!`,
    CLOSED:               `Ticket closed. Thank you for choosing us! Please rate your experience`,
    CANCELLED:            `Ticket cancelled`,
  };
  return lines[status];
}
