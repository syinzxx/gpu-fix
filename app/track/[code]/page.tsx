import Link from "next/link";
import { db } from "@/lib/db";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ACTIVE_STATUSES,
  type TicketStatus,
} from "@/lib/constants";
import { fmtDate, fmtDateTime, money } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { getLocale, getT } from "@/lib/locale";
import { LangToggle } from "@/components/lang-toggle";

export default async function TrackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [ticket, settings, t, locale] = await Promise.all([
    db.ticket.findUnique({
      where: { code: decodeURIComponent(code).toUpperCase() },
      include: {
        customer: { select: { name: true } },
        events: {
          where: { isPublic: true },
          orderBy: { createdAt: "desc" },
          select: { id: true, type: true, fromStatus: true, toStatus: true, note: true, createdAt: true },
        },
        partsUsed: { include: { part: { select: { name: true } } } },
        invoice: true,
      },
    }),
    getSettings(),
    getT(),
    getLocale(),
  ]);

  // Arabic status labels
  const arStatusLabels: Record<TicketStatus, string> = {
    RECEIVED: "مستلم",
    DIAGNOSING: "قيد التشخيص",
    QUOTE_SENT: "تم إرسال العرض",
    QUOTE_APPROVED: "تمت الموافقة",
    QUOTE_REJECTED: "تم الرفض",
    IN_REPAIR: "قيد الإصلاح",
    READY_FOR_PICKUP: "جاهز للاستلام",
    CLOSED: "مغلق",
  };
  const statusLabel = (s: TicketStatus) =>
    locale === "ar" ? arStatusLabels[s] : STATUS_LABELS[s];

  if (!ticket) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="absolute end-4 top-4">
          <LangToggle current={locale} />
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
          🔍
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-slate-900">
          {t.ticketNotFound}
        </h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">
          {t.checkCode}{" "}
          <span className="font-mono font-semibold">GPU-4F7K2</span>.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500"
        >
          {t.tryAnother}
        </Link>
      </main>
    );
  }

  const status = ticket.status as TicketStatus;
  const isActive = ACTIVE_STATUSES.includes(status);
  const queuePosition = isActive
    ? (await db.ticket.count({
        where: { status: { in: [...ACTIVE_STATUSES] }, createdAt: { lt: ticket.createdAt } },
      })) + 1
    : null;

  const showInvoice = ticket.invoice && (status === "READY_FOR_PICKUP" || status === "CLOSED");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      {/* Language toggle */}
      <div className="mb-4 flex justify-end">
        <LangToggle current={locale} />
      </div>

      {/* Ticket header */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-900/4 ring-1 ring-slate-900/5">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-cyan-400" />
        <div className="px-6 py-6 text-center">
          <p className="text-xs font-semibold text-slate-400">
            {settings.shopName} · {t.repairTracking}
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tracking-[0.1em] text-slate-900">
            {ticket.code}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {ticket.brand} {ticket.model} · {ticket.customer.name}
          </p>
        </div>
      </div>

      {/* Current status */}
      <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm shadow-slate-900/4 ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400">{t.currentStatus}</p>
          <p className="text-xs text-slate-400">{t.updated} {fmtDate(ticket.updatedAt)}</p>
        </div>
        <p className={`mt-2.5 inline-flex rounded-full px-4 py-1.5 text-sm font-bold ${STATUS_COLORS[status]}`}>
          {statusLabel(status)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-400">{t.queuePosition}</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">
              {queuePosition ? `#${queuePosition}` : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-400">{t.estCompletion}</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">
              {ticket.etaDate ? fmtDate(ticket.etaDate) : "—"}
            </p>
          </div>
        </div>

        {status === "QUOTE_SENT" && ticket.quoteAmount != null && (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
            <p className="text-xs font-bold text-amber-700">{t.repairQuote}</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight text-amber-800">
              {money(ticket.quoteAmount)}
            </p>
            <p className="mt-1.5 text-xs text-amber-700/80">{t.quoteApproval}</p>
          </div>
        )}

        {status === "READY_FOR_PICKUP" && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-100">
            <p className="font-display text-xl font-bold text-emerald-700">{t.readyPickupMsg}</p>
            <p className="mt-1 text-xs text-emerald-600">{t.bringTicket}</p>
          </div>
        )}
      </div>

      {/* Invoice */}
      {showInvoice && ticket.invoice && (
        <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm shadow-slate-900/4 ring-1 ring-slate-900/5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold text-slate-900">{t.invoice}</p>
            <p className="font-mono text-xs text-slate-400">{ticket.invoice.number}</p>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">{t.labor}</dt>
              <dd className="font-semibold text-slate-700">{money(ticket.invoice.laborAmount)}</dd>
            </div>
            {ticket.partsUsed.map((tp) => (
              <div key={tp.id} className="flex justify-between gap-4">
                <dt className="text-slate-500">
                  {tp.part.name} × {tp.quantity}
                </dt>
                <dd className="font-semibold text-slate-700">
                  {money(tp.unitPrice * tp.quantity)}
                </dd>
              </div>
            ))}
            {ticket.invoice.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <dt>{t.discount}</dt>
                <dd className="font-semibold">−{money(ticket.invoice.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-slate-900">
              <dt>{t.totalDue}</dt>
              <dd>{money(ticket.invoice.total)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Timeline */}
      <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm shadow-slate-900/4 ring-1 ring-slate-900/5">
        <p className="text-sm font-bold text-slate-900">{t.progress}</p>
        <ol className="mt-5">
          {ticket.events.map((e, i) => {
            const isLive = i === 0;
            return (
              <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                {i < ticket.events.length - 1 && (
                  <span className="absolute start-[7px] top-5 h-full w-0.5 rounded bg-slate-100" aria-hidden />
                )}
                <span
                  className={`relative mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    isLive ? "pulse-live bg-violet-600" : "bg-slate-200"
                  }`}
                  aria-hidden
                >
                  {isLive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">
                    {e.type === "NOTE" ? (
                      <span className="whitespace-pre-wrap">{e.note}</span>
                    ) : e.fromStatus ? (
                      <span className="font-semibold text-slate-900">
                        {statusLabel(e.toStatus as TicketStatus)}
                      </span>
                    ) : (
                      <>
                        {t.deviceReceived} —{" "}
                        <span className="font-semibold text-slate-900">{t.ticketOpened}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(e.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        {t.questions}{settings.shopPhone ? ` at ${settings.shopPhone}` : ""} {t.weHelpYou}
      </p>
    </main>
  );
}
