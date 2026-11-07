import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  customerStatusLabelsFor,
  PAYMENT_METHODS,
  PAYMENT_KINDS,
  PAYMENT_KIND_COLORS,
  WORK_TYPE_LABELS,
  type CustomerStatus,
  type WorkType,
} from "@/lib/constants";
import {
  setCustomerStatus,
  addNote,
  assignTicket,
  updateTicketDetails,
  addPartToTicket,
  removePartFromTicket,
  createInvoice,
  resendWhatsapp,
  setWarranty,
} from "@/app/actions/tickets";
import { recordPayment, deleteVoidPayment } from "@/app/actions/payments";
import { uploadAttachment, deleteAttachment } from "@/app/actions/attachments";
import { toggleChecklistItem, loadChecklist } from "@/app/actions/checklists";
import { Button, Input, Label, Select, Textarea, Card, CardHeader, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { StaffStatusBadge, CustomerStatusBadge, PriorityBadge } from "@/components/status-badge";
import { fmtDate, fmtDateTime, money, paymentsTotal, cn } from "@/lib/utils";
import { getLocale, getT } from "@/lib/locale";
import { Icon } from "@/components/icons";
import { TicketBoardCard } from "@/components/ticket-board-card";

const WA_STATUS_COLORS: Record<string, string> = {
  SENT:      "bg-emerald-100 text-emerald-700",
  DELIVERED: "bg-sky-100 text-sky-700",
  READ:      "bg-violet-100 text-violet-700",
  SKIPPED:   "bg-amber-100 text-amber-700",
  FAILED:    "bg-rose-100 text-rose-700",
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [ticket, session, t, locale] = await Promise.all([
    db.ticket.findUnique({
      where: { id },
      include: {
        customer: true,
        board: true,
        assignedTo: true,
        createdBy: true,
        events: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
        partsUsed: { include: { part: true }, orderBy: { createdAt: "asc" } },
        invoice: true,
        whatsappLogs: { orderBy: { createdAt: "desc" }, take: 5 },
        payments: { include: { receivedBy: true }, orderBy: { createdAt: "desc" } },
        attachments: { orderBy: { createdAt: "desc" } },
        checklistItems: { include: { checkedBy: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
    auth(),
    getT(),
    getLocale(),
  ]);
  if (!ticket) notFound();

  const originalTicket =
    ticket.isWarrantyReturn && ticket.warrantyTicketId
      ? await db.ticket.findUnique({
          where: { code: ticket.warrantyTicketId },
          select: { id: true },
        })
      : null;

  const isAdmin = session?.user?.role === "ADMIN";
  const totalPaid = paymentsTotal(ticket.payments);
  const preChecks = ticket.checklistItems.filter((c) => c.phase === "PRE");
  const postChecks = ticket.checklistItems.filter((c) => c.phase === "POST");

  const [technicians, parts, queueAhead] = await Promise.all([
    db.user.findMany({ where: { active: true, role: { in: ["TECHNICIAN", "ADMIN"] } }, orderBy: { name: "asc" } }),
    db.part.findMany({ where: { quantity: { gt: 0 } }, orderBy: { name: "asc" } }),
    ticket.staffStatus !== "CLOSED"
      ? db.ticket.count({
          where: { staffStatus: { not: "CLOSED" }, createdAt: { lt: ticket.createdAt } },
        })
      : Promise.resolve(0),
  ]);

  const customerStatusLabels = customerStatusLabelsFor(locale);
  const partsTotal = ticket.partsUsed.reduce((s, p) => s + p.unitPrice * p.quantity, 0);
  const dateInputValue = ticket.etaDate ? new Date(ticket.etaDate).toISOString().slice(0, 10) : "";

  const warrantyExpiry =
    ticket.warrantyDays && ticket.closedAt
      ? new Date(ticket.closedAt.getTime() + ticket.warrantyDays * 86400_000)
      : null;
  const underWarranty = warrantyExpiry ? warrantyExpiry > new Date() : false;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-3xl font-semibold tracking-[0.12em] text-slate-900">{ticket.code}</h1>
            <StaffStatusBadge status={ticket.staffStatus} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.isWarrantyReturn && (
              <Badge className="bg-amber-100 text-amber-700">{t.warrantyReturn}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {ticket.deviceType} · {ticket.brand} {ticket.model}
            {ticket.serialNumber && ` · SN ${ticket.serialNumber}`}
            {ticket.staffStatus !== "CLOSED" && <> · <span className="font-medium text-violet-700">#{queueAhead + 1} {t.queueIn}</span></>}
            {ticket.isWarrantyReturn && ticket.warrantyTicketId && (
              <>
                {" · "}
                {originalTicket ? (
                  <Link
                    href={`/dashboard/tickets/${originalTicket.id}`}
                    className="font-medium text-amber-600 hover:underline"
                  >
                    {t.ref} {ticket.warrantyTicketId}
                  </Link>
                ) : (
                  <span className="text-amber-600">
                    {t.ref} {ticket.warrantyTicketId}
                  </span>
                )}
              </>
            )}
          </p>
          {ticket.rating != null && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1 ring-1 ring-amber-100">
              <span className="text-sm tracking-tight text-amber-500" aria-label={t.nOutOf5Stars.replace("{n}", String(ticket.rating))}>
                {"★".repeat(ticket.rating)}
                <span className="text-amber-200">{"★".repeat(5 - ticket.rating)}</span>
              </span>
              {ticket.ratingComment && (
                <span className="text-xs text-slate-500">&ldquo;{ticket.ratingComment}&rdquo;</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/tickets/${ticket.id}/label`}
            className="rounded-lg bg-white px-3 py-2.5 font-display text-[11px] font-extrabold tracking-[0.08em] text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"
          >
            {t.printLabel}
          </Link>
          <Link
            href={`/track/${ticket.code}`}
            target="_blank"
            className="rounded-lg bg-white px-3 py-2.5 font-display text-[11px] font-extrabold tracking-[0.08em] text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"
          >
            {t.customerView}
          </Link>
          {ticket.invoice && (
            <Link
              href={`/dashboard/invoices/${ticket.invoice.id}`}
              className="rounded-lg bg-white px-3 py-2.5 font-display text-[11px] font-extrabold tracking-[0.08em] text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"
            >
              {t.invoice} {ticket.invoice.number}
            </Link>
          )}
        </div>
      </div>

      {/* Customer status */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer status</p>
          <CustomerStatusBadge status={ticket.customerStatus} />
        </div>
        <form action={setCustomerStatus} className="space-y-3">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_STATUSES.map((s) => (
              <button
                key={s}
                type="submit"
                name="customerStatus"
                value={s}
                disabled={ticket.customerStatus === s}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-all",
                  ticket.customerStatus === s
                    ? CUSTOMER_STATUS_COLORS[s as CustomerStatus]
                    : "bg-white text-slate-500 ring-slate-200 hover:ring-slate-300 disabled:opacity-50"
                )}
              >
                {CUSTOMER_STATUS_LABELS[s as CustomerStatus]}
              </button>
            ))}
          </div>
          {ticket.customerStatus !== "WAITING_FOR_APPROVAL" && (
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Set to &ldquo;Awaiting Approval&rdquo; with quote:
                </label>
                <input
                  type="number"
                  name="quoteAmount"
                  step="0.01"
                  min="0"
                  defaultValue={ticket.quoteAmount ?? ""}
                  placeholder="Quote amount"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-36 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
            </div>
          )}
          {ticket.customerStatus === "WAITING_FOR_APPROVAL" && ticket.quoteAmount != null && (
            <p className="text-xs text-amber-700">
              Current quote: <strong>{ticket.quoteAmount}</strong> — customer has been notified.
            </p>
          )}
        </form>
        <p className="mt-2 text-xs text-slate-400">{t.statusLoggedWhatsapp ?? "Status change logged and customer notified via WhatsApp."}</p>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title={t.issue} />
            <div className="p-5 text-sm text-slate-900">
              <p className="whitespace-pre-wrap">{ticket.issue}</p>
              {ticket.workType && (
                <p className="mt-2 text-xs text-slate-500">
                  Work type:{" "}
                  <span className="font-medium">
                    {WORK_TYPE_LABELS[ticket.workType as WorkType] ?? ticket.workType}
                  </span>
                </p>
              )}
              {ticket.accessories && (
                <p className="mt-3 text-xs text-slate-400">{t.accessories} {ticket.accessories}</p>
              )}
            </div>
          </Card>

          {/* Pre/post-repair checklists */}
          <Card>
            <CardHeader title={t.preRepairChecks} />
            {preChecks.length === 0 ? (
              <div className="p-5">
                <EmptyState message={t.noChecklistYet} />
                <form action={loadChecklist} className="mt-2 flex justify-center">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <Button type="submit" size="sm" variant="secondary">{t.loadChecklist}</Button>
                </form>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {preChecks.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className={cn("text-sm", item.checked ? "text-slate-400 line-through" : "text-slate-900")}>
                        {item.label}
                      </p>
                      {item.checked && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          {item.checkedBy?.name ?? "—"} · {fmtDateTime(item.checkedAt)}
                        </p>
                      )}
                    </div>
                    <form action={toggleChecklistItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" size="sm" variant={item.checked ? "ghost" : "secondary"}>
                        {item.checked ? t.checkedLabel : t.markDone}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t.postRepairChecks} />
            {postChecks.length === 0 ? (
              <div className="p-5">
                <EmptyState message={t.noChecklistYet} />
                <form action={loadChecklist} className="mt-2 flex justify-center">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <Button type="submit" size="sm" variant="secondary">{t.loadChecklist}</Button>
                </form>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {postChecks.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className={cn("text-sm", item.checked ? "text-slate-400 line-through" : "text-slate-900")}>
                        {item.label}
                      </p>
                      {item.checked && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          {item.checkedBy?.name ?? "—"} · {fmtDateTime(item.checkedAt)}
                        </p>
                      )}
                    </div>
                    <form action={toggleChecklistItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" size="sm" variant={item.checked ? "ghost" : "secondary"}>
                        {item.checked ? t.checkedLabel : t.markDone}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader title={t.photos} />
            <form action={uploadAttachment} className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div className="min-w-[180px] flex-1">
                <Label>{t.photo}</Label>
                <input
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="block w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>
              <div className="w-36">
                <Label>{t.kind}</Label>
                <Select name="kind" defaultValue="INTAKE">
                  <option value="INTAKE">{t.intake}</option>
                  <option value="COMPLETION">{t.completion}</option>
                  <option value="OTHER">{t.other}</option>
                </Select>
              </div>
              <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-500">
                <input type="checkbox" name="isPublic" className="accent-violet-600" />
                {t.visibleToCustomerShort}
              </label>
              <Button type="submit" variant="secondary">{t.upload}</Button>
            </form>
            {ticket.attachments.length === 0 ? (
              <EmptyState message={t.noPhotosYet} />
            ) : (
              <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4">
                {ticket.attachments.map((a) => (
                  <div key={a.id} className="group relative overflow-hidden rounded-lg ring-1 ring-slate-200">
                    <a href={a.path} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- staff-uploaded photo served from public/uploads, not eligible for next/image optimization */}
                      <img src={a.path} alt="" className="aspect-square w-full object-cover" />
                    </a>
                    <Badge className="absolute left-1 top-1 bg-white/90 text-slate-600">{a.kind}</Badge>
                    {a.isPublic && (
                      <Badge className="absolute right-1 top-1 bg-emerald-100 text-emerald-700">{t.publicLabel}</Badge>
                    )}
                    {(isAdmin || a.createdById === session?.user?.id) && (
                      <form action={deleteAttachment} className="absolute bottom-1 right-1">
                        <input type="hidden" name="id" value={a.id} />
                        <Button
                          size="sm"
                          variant="ghost"
                          type="submit"
                          className="bg-white/90 backdrop-blur hover:bg-white"
                          title={t.deletePhoto}
                        >
                          ✕
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Parts used */}
          <Card>
            <CardHeader title={t.partsUsed} />
            {ticket.partsUsed.length === 0 ? (
              <EmptyState message={t.noPartsYet} />
            ) : (
              <Table>
                <thead>
                  <tr><Th>{t.part}</Th><Th>{t.qty}</Th><Th>{t.unitPrice}</Th><Th>{t.total}</Th><Th></Th></tr>
                </thead>
                <tbody>
                  {ticket.partsUsed.map((tp) => (
                    <tr key={tp.id}>
                      <Td>{tp.part.name} <span className="text-xs text-slate-400">({tp.part.sku})</span></Td>
                      <Td>{tp.quantity}</Td>
                      <Td>{money(tp.unitPrice)}</Td>
                      <Td className="font-medium">{money(tp.unitPrice * tp.quantity)}</Td>
                      <Td>
                        {!ticket.invoice && (
                          <form action={removePartFromTicket}>
                            <input type="hidden" name="ticketPartId" value={tp.id} />
                            <Button size="sm" variant="ghost" type="submit" title={t.removeRestock}>✕</Button>
                          </form>
                        )}
                      </Td>
                    </tr>
                  ))}
                  <tr>
                    <Td colSpan={3} className="text-right font-medium">{t.partsTotal}</Td>
                    <Td className="font-bold">{money(partsTotal)}</Td>
                    <Td></Td>
                  </tr>
                </tbody>
              </Table>
            )}
            {!ticket.invoice && (
              <form action={addPartToTicket} className="flex items-end gap-2 border-t border-slate-100 p-4">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <div className="flex-1">
                  <Label>{t.addPart}</Label>
                  <Select name="partId" required defaultValue="">
                    <option value="" disabled>{t.selectPart}</option>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.quantity} {t.inStock} — {money(p.sellPrice)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-20">
                  <Label>{t.qty}</Label>
                  <Input name="quantity" type="number" min="1" defaultValue="1" required />
                </div>
                <Button type="submit" variant="secondary">{t.add}</Button>
              </form>
            )}
          </Card>

          {/* Payments */}
          <Card>
            <CardHeader title={t.payments} />
            {ticket.payments.length === 0 ? (
              <EmptyState message={t.noPaymentsYet} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t.amount}</Th><Th>{t.method}</Th><Th>{t.kind}</Th><Th>{t.receivedByCol}</Th><Th>{t.when}</Th><Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {ticket.payments.map((p) => (
                    <tr key={p.id}>
                      <Td className={p.kind === "REFUND" ? "font-medium text-rose-600" : "font-medium"}>
                        {p.kind === "REFUND" ? `−${money(p.amount)}` : money(p.amount)}
                      </Td>
                      <Td>{p.method}</Td>
                      <Td><Badge className={PAYMENT_KIND_COLORS[p.kind] ?? "bg-slate-100 text-slate-600"}>{p.kind}</Badge></Td>
                      <Td className="text-xs text-slate-500">{p.receivedBy?.name ?? "—"}</Td>
                      <Td className="text-xs text-slate-400">
                        {fmtDateTime(p.createdAt)}
                        {p.note && <span className="block text-slate-400">{p.note}</span>}
                      </Td>
                      <Td>
                        {isAdmin && (
                          <form action={deleteVoidPayment}>
                            <input type="hidden" name="id" value={p.id} />
                            <Button size="sm" variant="ghost" type="submit" title={t.deletePayment}>✕</Button>
                          </form>
                        )}
                      </Td>
                    </tr>
                  ))}
                  <tr>
                    <Td colSpan={4} className="text-right font-medium">{t.totalPaid}</Td>
                    <Td colSpan={2} className="font-bold">{money(totalPaid)}</Td>
                  </tr>
                </tbody>
              </Table>
            )}
            <form action={recordPayment} className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-4">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div className="w-28">
                <Label>{t.amount}</Label>
                <Input name="amount" type="number" step="0.01" min="0.01" required />
              </div>
              <div className="w-32">
                <Label>{t.method}</Label>
                <Select name="method" defaultValue="CASH">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </div>
              <div className="w-32">
                <Label>{t.kind}</Label>
                <Select name="kind" defaultValue="PAYMENT">
                  {PAYMENT_KINDS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </Select>
              </div>
              <div className="min-w-[140px] flex-1">
                <Label>{t.note}</Label>
                <Input name="note" placeholder={t.optional} />
              </div>
              <Button type="submit" variant="secondary">{t.record}</Button>
            </form>
          </Card>

          {/* Timeline + notes */}
          <Card>
            <CardHeader title={t.timelineNotes} />
            <form action={addNote} className="flex items-start gap-2 border-b border-slate-100 p-4">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div className="flex-1">
                <Textarea name="note" rows={2} required placeholder={t.addRepairNote} />
                <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" name="isPublic" className="accent-violet-600" />
                  {t.visibleToCustomer}
                </label>
              </div>
              <Button type="submit" variant="secondary">{t.post}</Button>
            </form>
            <ul className="divide-y divide-slate-100 p-2">
              {ticket.events.map((e) => (
                <li key={e.id} className="flex gap-3 px-3 py-3">
                  <span className="mt-0.5 text-violet-600">
                    <Icon
                      size={16}
                      name={e.type === "NOTE" ? "note" : e.type === "ASSIGNMENT" ? "user" : e.type === "PAYMENT" ? "money" : "refresh"}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900">
                      {e.type === "STATUS_CHANGE" || e.type === "CREATED" ? (
                        <>
                          {e.fromStatus ? `${customerStatusLabels[e.fromStatus as CustomerStatus] ?? e.fromStatus} → ` : `${t.ticketCreated} — `}
                          <span className="font-medium">{customerStatusLabels[e.toStatus as CustomerStatus] ?? e.toStatus}</span>
                        </>
                      ) : (
                        <span className="whitespace-pre-wrap">{e.note}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {fmtDateTime(e.createdAt)}
                      {e.createdBy && ` · ${e.createdBy.name}`}
                      {e.isPublic && e.type === "NOTE" && (
                        <Badge className="ml-2 bg-emerald-100 text-emerald-700">{t.publicLabel}</Badge>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Card>
            <CardHeader title={t.customerCard} />
            <div className="space-y-1 p-5 text-sm">
              <p className="font-medium text-slate-900">{ticket.customer.name}</p>
              <p className="text-slate-500">{ticket.customer.phone}</p>
              {ticket.customer.whatsapp && ticket.customer.whatsapp !== ticket.customer.phone && (
                <p className="text-slate-500">{t.whatsapp}: {ticket.customer.whatsapp}</p>
              )}
              {ticket.customer.email && <p className="text-slate-500">{ticket.customer.email}</p>}
            </div>
          </Card>

          {ticket.intakeSignature && (
            <Card>
              <CardHeader title={t.intakeSignature} />
              <div className="p-5">
                {/* eslint-disable-next-line @next/next/no-img-element -- staff-only view of a captured PNG data URL, not eligible for next/image optimization */}
                <img
                  src={ticket.intakeSignature}
                  alt={t.intakeSignatureAlt}
                  className="max-h-32 w-full rounded-lg border border-slate-200 bg-white object-contain"
                />
              </div>
            </Card>
          )}

          <TicketBoardCard ticket={ticket} t={t} />

          <Card>
            <CardHeader title={t.assignment} />
            <form action={assignTicket} className="flex items-end gap-2 p-5">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div className="flex-1">
                <Select name="assignedToId" defaultValue={ticket.assignedToId ?? ""}>
                  <option value="">{t.unassigned}</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="secondary">{t.save}</Button>
            </form>
          </Card>

          <Card>
            <CardHeader title={t.etaLabor} />
            <form action={updateTicketDetails} className="space-y-3 p-5">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div>
                <Label>{t.estimatedCompletion}</Label>
                <Input name="etaDate" type="date" defaultValue={dateInputValue} />
              </div>
              <div>
                <Label>{t.laborCost}</Label>
                <Input name="laborCost" type="number" step="0.01" min="0" defaultValue={ticket.laborCost} />
              </div>
              <Button type="submit" variant="secondary" className="w-full">{t.save}</Button>
            </form>
          </Card>

          <Card>
            <CardHeader title={t.warranty} />
            <form action={setWarranty} className="space-y-3 p-5">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div>
                <Label>{t.warrantyPeriod}</Label>
                <Input name="warrantyDays" type="number" min="0" step="1"
                  defaultValue={ticket.warrantyDays ?? ""} placeholder={t.warrantyDaysPlaceholder} />
                <p className="mt-1 text-xs text-slate-400">{t.noWarranty}</p>
              </div>
              {warrantyExpiry && (
                <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${underWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {underWarranty ? t.underWarrantyUntil : t.warrantyExpired} {fmtDate(warrantyExpiry)}
                </p>
              )}
              <Button type="submit" variant="secondary" className="w-full">{t.save}</Button>
            </form>
          </Card>

          <Card>
            <CardHeader title={t.billing} />
            <div className="space-y-2 p-5 text-sm">
              {ticket.quoteAmount != null && (
                <div className="flex justify-between"><span className="text-slate-500">{t.quote}</span><span>{money(ticket.quoteAmount)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-500">{t.labor}</span><span>{money(ticket.laborCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t.parts}</span><span>{money(partsTotal)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                <span>{t.runningTotal}</span><span>{money(ticket.laborCost + partsTotal)}</span>
              </div>

              {ticket.invoice ? (
                <Link
                  href={`/dashboard/invoices/${ticket.invoice.id}`}
                  className="mt-2 block rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-slate-700"
                >
                  {t.viewInvoiceBtn} {ticket.invoice.number}
                </Link>
              ) : (
                <form action={createInvoice} className="mt-2 space-y-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <div>
                    <Label>{t.discountOptional}</Label>
                    <Input name="discount" type="number" step="0.01" min="0" defaultValue="0" />
                  </div>
                  <Button type="submit" className="w-full">{t.issueInvoice}</Button>
                </form>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t.whatsappCard} />
            <form action={resendWhatsapp} className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <p className="text-xs text-slate-400">{t.sendCurrentStatus}</p>
              <Button type="submit" size="sm" variant="secondary">{t.resend}</Button>
            </form>
            {ticket.whatsappLogs.length === 0 ? (
              <p className="p-4 text-xs text-slate-400">{t.noLogsYet}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {ticket.whatsappLogs.map((w) => (
                  <li key={w.id} className="p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge className={WA_STATUS_COLORS[w.status] ?? "bg-slate-100 text-slate-500"}>
                        {w.status === "SKIPPED" ? t.sendManually : w.status.toLowerCase()}
                      </Badge>
                      <span className="text-slate-400">{fmtDateTime(w.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-slate-500 select-all">{w.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="text-xs text-slate-400">
            {t.created} {fmtDateTime(ticket.createdAt)} {t.by} {ticket.createdBy.name}
            {ticket.closedAt && <> · {t.closedAtLabel} {fmtDateTime(ticket.closedAt)}</>}
          </p>
        </div>
      </div>
    </div>
  );
}
