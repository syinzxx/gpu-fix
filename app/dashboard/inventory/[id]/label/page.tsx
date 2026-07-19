import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/print-button";
import { money } from "@/lib/utils";

export default async function PartLabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const part = await db.part.findUnique({
    where: { id },
    select: { id: true, sku: true, name: true, sellPrice: true },
  });
  if (!part) notFound();

  const qrDataUrl = await QRCode.toDataURL(part.sku, { margin: 1, width: 200 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/dashboard/inventory/${part.id}`} className="text-sm text-violet-700 hover:underline">
          ← Back to part
        </Link>
        <PrintButton />
      </div>

      <div className="print-label mx-auto w-[76mm] rounded-md border border-slate-200 bg-white p-3 text-center print:border-0">
        <p className="text-sm font-bold text-slate-900">{part.name}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- server-generated QR data URL, not eligible for next/image optimization */}
        <img src={qrDataUrl} alt="SKU QR code" className="mx-auto mt-2 h-24 w-24" />
        <p className="mt-1 font-mono text-sm font-semibold tracking-wide text-slate-900">{part.sku}</p>
        <p className="mt-1 text-xs text-slate-500">{money(part.sellPrice)}</p>
      </div>
    </div>
  );
}
