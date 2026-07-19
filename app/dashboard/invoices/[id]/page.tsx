import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/print-button";
import { fmtDate, money, paymentsTotal } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/locale";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [invoice, settings, t] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: {
        ticket: {
          include: {
            customer: true,
            partsUsed: { include: { part: true } },
            payments: { select: { amount: true, kind: true } },
            checklistItems: {
              where: { phase: "POST", checked: true },
              orderBy: { sortOrder: "asc" },
              select: { id: true, label: true },
            },
          },
        },
      },
    }),
    getSettings(),
    getT(),
  ]);
  if (!invoice) notFound();

  const { ticket } = invoice;
  const totalPaid = paymentsTotal(ticket.payments);
  const balanceDue = invoice.total - totalPaid;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/dashboard/tickets/${ticket.id}`} className="text-sm text-violet-700 hover:underline">
          {t.backToTicket} {ticket.code}
        </Link>
        <PrintButton />
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-8 print:border-0">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
          <div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-slate-900">
              {settings.shopName}
            </h1>
            {settings.shopAddress && (
              <p className="mt-1 text-xs text-slate-500">{settings.shopAddress}</p>
            )}
            {settings.shopPhone && (
              <p className="text-xs text-slate-500">{settings.shopPhone}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold tracking-wider text-slate-900">{invoice.number}</p>
            <p className="font-mono text-[11px] text-slate-500">{t.issuedOn} {fmtDate(invoice.issuedAt)}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="silk-label text-slate-400">{t.billedTo}</p>
            <p className="mt-1 font-medium text-slate-900">{ticket.customer.name}</p>
            <p className="text-slate-500">{ticket.customer.phone}</p>
          </div>
          <div>
            <p className="silk-label text-slate-400">{t.repair}</p>
            <p className="mt-1 font-medium text-slate-900">
              {ticket.brand} {ticket.model}
            </p>
            <p className="text-slate-500">
              {t.tickets.replace(/\p{L}+/u, "Ticket")} {ticket.code}
              {ticket.serialNumber && ` · SN ${ticket.serialNumber}`}
            </p>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left silk-label text-slate-400">
              <th className="pb-2">{t.item}</th>
              <th className="pb-2 text-center">{t.qty}</th>
              <th className="pb-2 text-end">{t.unit}</th>
              <th className="pb-2 text-end">{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.laborAmount > 0 && (
              <tr className="border-b border-slate-100">
                <td className="py-2.5">{t.repairLabor}</td>
                <td className="py-2.5 text-center">1</td>
                <td className="py-2.5 text-end">{money(invoice.laborAmount)}</td>
                <td className="py-2.5 text-end">{money(invoice.laborAmount)}</td>
              </tr>
            )}
            {ticket.partsUsed.map((tp) => (
              <tr key={tp.id} className="border-b border-slate-100">
                <td className="py-2.5">
                  {tp.part.name}
                  <span className="ms-1 text-xs text-slate-400">({tp.part.sku})</span>
                </td>
                <td className="py-2.5 text-center">{tp.quantity}</td>
                <td className="py-2.5 text-end">{money(tp.unitPrice)}</td>
                <td className="py-2.5 text-end">{money(tp.unitPrice * tp.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="ms-auto mt-4 w-56 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>{t.subtotal}</span>
            <span>{money(invoice.laborAmount + invoice.partsAmount)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>{t.discount}</span>
              <span>−{money(invoice.discount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 text-base font-bold text-slate-900">
            <span>{t.totalDue}</span>
            <span className="font-mono">{money(invoice.total)}</span>
          </div>
          {totalPaid > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>{t.paidAmount}</span>
              <span className="font-mono">{money(totalPaid)}</span>
            </div>
          )}
          {balanceDue <= 0 ? (
            <div className="mt-1 rounded-lg bg-emerald-50 py-1.5 text-center text-sm font-bold tracking-wide text-emerald-700 ring-1 ring-emerald-100">
              {t.paidInFull}
            </div>
          ) : (
            <div className="flex justify-between text-sm font-bold text-rose-600">
              <span>{t.balanceDue}</span>
              <span className="font-mono">{money(balanceDue)}</span>
            </div>
          )}
        </div>

        {ticket.checklistItems.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="silk-label text-slate-400">{t.qualityChecksPassed}</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              {ticket.checklistItems.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5">
                  <span className="text-emerald-600">✓</span> {c.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
          {t.paymentDue}
        </p>
      </div>
    </div>
  );
}
