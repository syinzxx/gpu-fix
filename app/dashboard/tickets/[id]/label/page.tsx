import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/print-button";

export default async function TicketLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [ticket, settings] = await Promise.all([
    db.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        brand: true,
        model: true,
        customer: { select: { name: true, phone: true } },
      },
    }),
    getSettings(),
  ]);
  if (!ticket) notFound();

  const trackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/track/${ticket.code}`;
  const qrDataUrl = await QRCode.toDataURL(trackUrl, { margin: 1, width: 220 });

  const firstName = ticket.customer.name.trim().split(/\s+/)[0] || ticket.customer.name;
  const phoneDigits = ticket.customer.phone.replace(/\D/g, "");
  const phoneLast4 = phoneDigits.slice(-4).padStart(4, "•");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/dashboard/tickets/${ticket.id}`} className="text-sm text-violet-700 hover:underline">
          ← Back to ticket
        </Link>
        <PrintButton />
      </div>

      <div className="print-label mx-auto w-[76mm] rounded-md border border-slate-200 bg-white p-3 text-center print:border-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{settings.shopName}</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-[0.15em] text-slate-900">{ticket.code}</p>
        <p className="mt-1 text-xs text-slate-600">
          {firstName} · ***{phoneLast4}
        </p>
        <p className="text-xs text-slate-600">
          {ticket.brand} {ticket.model}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- server-generated QR data URL, not eligible for next/image optimization */}
        <img src={qrDataUrl} alt="Tracking QR code" className="mx-auto mt-2 h-28 w-28" />
        <p className="mt-1 text-[9px] text-slate-400">Scan to track repair</p>
      </div>
    </div>
  );
}
