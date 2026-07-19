const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "EGP";

export function money(n: number): string {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${CURRENCY}`;
}

// Unambiguous alphabet (no 0/O, 1/I/L)
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateTicketCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `GPU-${s}`;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Nets a set of ticket payments to a single amount: DEPOSIT/PAYMENT add,
// REFUND subtracts (refund amounts are stored positive).
export function paymentsTotal(payments: { amount: number; kind: string }[]): number {
  return payments.reduce((sum, p) => sum + (p.kind === "REFUND" ? -p.amount : p.amount), 0);
}
