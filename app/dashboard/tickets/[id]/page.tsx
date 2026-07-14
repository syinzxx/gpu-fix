import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  STATUS_FLOW,
  STATUS_LABELS,
  ACTIVE_STATUSES,
  type TicketStatus,
} from "@/lib/constants";
import {
  changeStatus,
  addNote,
  assignTicket,
  updateTicketDetails,
  addPartToTicket,
  removePartFromTicket,
  createInvoice,
} from "@/app/actions/tickets";
import { Button, Input, Label, Select, Textarea, Card, CardHeader, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { fmtDate, fmtDateTime, money } from "@/lib/utils";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedTo: true,
      createdBy: true,
      events: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
      partsUsed: { include: { part: true }, orderBy: { createdAt: "asc" } },
      invoice: true,
      whatsappLogs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!ticket) notFound();

  const [technicians, parts, queueAhead] = await Promise.all([
    db.user.findMany({ where: { active: true, role: { in: ["TECHNICIAN", "ADMIN"] } }, orderBy: { name: "asc" } }),
    db.part.findMany({ where: { quantity: { gt: 0 } }, orderBy: { name: "asc" } }),
    ACTIVE_STATUSES.includes(ticket.status as TicketStatus)
      ? db.ticket.count({
          where: { status: { in: [...ACTIVE_STATUSES] }, createdAt: { lt: ticket.createdAt } },
        })
      : Promise.resolve(0),
  ]);

  const nextStatuses = STATUS_FLOW[ticket.status as TicketStatus] ?? [];
  const partsTotal = ticket.partsUsed.reduce((s, p) => s + p.unitPrice * p.quantity, 0);
  const dateInputValue = ticket.etaDate ? new Date(ticket.etaDate).toISOString().slice(0, 10) : "";
  const isActive = ACTIVE_STATUSES.includes(ticket.status as TicketStatus);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-3xl font-semibold tracking-[0.12em] text-slate-900">{ticket.code}</h1>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {ticket.deviceType} · {ticket.brand} {ticket.model}
            {ticket.serialNumber && ` · SN ${ticket.serialNumber}`}
            {isActive && <> · <span className="font-medium text-violet-700">#{queueAhead + 1} in queue</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/track/${ticket.code}`}
            target="_blank"
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"
          >
            Customer view ↗
          </Link>
          {ticket.invoice && (
            <Link
              href={`/dashboard/invoices/${ticket.invoice.id}`}
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"
            >
              Invoice {ticket.invoice.number}
            </Link>
          )}
        </div>
      </div>

      {/* Status actions */}
      {nextStatuses.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Move ticket forward</p>
          <div className="flex flex-wrap items-end gap-3">
            {nextStatuses.map((next) => (
              <form key={next} action={changeStatus} className="flex items-end gap-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <input type="hidden" name="toStatus" value={next} />
                {next === "QUOTE_SENT" && (
                  <div>
                    <Label>Quote amount</Label>
                    <Input name="quoteAmount" type="number" step="0.01" min="0" required
                      defaultValue={ticket.quoteAmount ?? ""} className="w-32" />
                  </div>
                )}
                <Button type="submit" variant={next === "QUOTE_REJECTED" ? "danger" : "primary"}>
                  → {STATUS_LABELS[next]}
                </Button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Each change is logged and sent to the customer on WhatsApp.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Issue" />
            <div className="p-5 text-sm text-slate-900">
              <p className="whitespace-pre-wrap">{ticket.issue}</p>
              {ticket.accessories && (
                <p className="mt-3 text-xs text-slate-400">Accessories: {ticket.accessories}</p>
              )}
            </div>
          </Card>

          {/* Parts used */}
          <Card>
            <CardHeader title="Parts used" />
            {ticket.partsUsed.length === 0 ? (
              <EmptyState message="No parts consumed yet." />
            ) : (
              <Table>
                <thead>
                  <tr><Th>Part</Th><Th>Qty</Th><Th>Unit price</Th><Th>Total</Th><Th></Th></tr>
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
                            <Button size="sm" variant="ghost" type="submit" title="Remove and restock">✕</Button>
                          </form>
                        )}
                      </Td>
                    </tr>
                  ))}
                  <tr>
                    <Td colSpan={3} className="text-right font-medium">Parts total</Td>
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
                  <Label>Add part (decrements stock)</Label>
                  <Select name="partId" required defaultValue="">
                    <option value="" disabled>Select a part…</option>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.quantity} in stock — {money(p.sellPrice)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-20">
                  <Label>Qty</Label>
                  <Input name="quantity" type="number" min="1" defaultValue="1" required />
                </div>
                <Button type="submit" variant="secondary">Add</Button>
              </form>
            )}
          </Card>

          {/* Timeline + notes */}
          <Card>
            <CardHeader title="Timeline & notes" />
            <form action={addNote} className="flex items-start gap-2 border-b border-slate-100 p-4">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div className="flex-1">
                <Textarea name="note" rows={2} required placeholder="Add a repair note…" />
                <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" name="isPublic" className="accent-violet-600" />
                  Visible to customer on tracking page
                </label>
              </div>
              <Button type="submit" variant="secondary">Post</Button>
            </form>
            <ul className="divide-y divide-slate-100 p-2">
              {ticket.events.map((e) => (
                <li key={e.id} className="flex gap-3 px-3 py-3">
                  <span className="mt-0.5 text-sm">
                    {e.type === "NOTE" ? "📝" : e.type === "ASSIGNMENT" ? "👤" : "🔄"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900">
                      {e.type === "STATUS_CHANGE" || e.type === "CREATED" ? (
                        <>
                          {e.fromStatus ? `${STATUS_LABELS[e.fromStatus as TicketStatus]} → ` : "Ticket created — "}
                          <span className="font-medium">{STATUS_LABELS[e.toStatus as TicketStatus]}</span>
                        </>
                      ) : (
                        <span className="whitespace-pre-wrap">{e.note}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {fmtDateTime(e.createdAt)}
                      {e.createdBy && ` · ${e.createdBy.name}`}
                      {e.isPublic && e.type === "NOTE" && (
                        <Badge className="ml-2 bg-emerald-100 text-emerald-700">public</Badge>
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
            <CardHeader title="Customer" />
            <div className="space-y-1 p-5 text-sm">
              <p className="font-medium text-slate-900">{ticket.customer.name}</p>
              <p className="text-slate-500">{ticket.customer.phone}</p>
              {ticket.customer.whatsapp && ticket.customer.whatsapp !== ticket.customer.phone && (
                <p className="text-slate-500">WA: {ticket.customer.whatsapp}</p>
              )}
              {ticket.customer.email && <p className="text-slate-500">{ticket.customer.email}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Assignment" />
            <form action={assignTicket} className="flex items-end gap-2 p-5">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div className="flex-1">
                <Select name="assignedToId" defaultValue={ticket.assignedToId ?? ""}>
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="secondary">Save</Button>
            </form>
          </Card>

          <Card>
            <CardHeader title="ETA & labor" />
            <form action={updateTicketDetails} className="space-y-3 p-5">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div>
                <Label>Estimated completion</Label>
                <Input name="etaDate" type="date" defaultValue={dateInputValue} />
              </div>
              <div>
                <Label>Labor cost</Label>
                <Input name="laborCost" type="number" step="0.01" min="0" defaultValue={ticket.laborCost} />
              </div>
              <Button type="submit" variant="secondary" className="w-full">Save</Button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Billing" />
            <div className="space-y-2 p-5 text-sm">
              {ticket.quoteAmount != null && (
                <div className="flex justify-between"><span className="text-slate-500">Quote</span><span>{money(ticket.quoteAmount)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-500">Labor</span><span>{money(ticket.laborCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Parts</span><span>{money(partsTotal)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                <span>Running total</span><span>{money(ticket.laborCost + partsTotal)}</span>
              </div>

              {ticket.invoice ? (
                <Link
                  href={`/dashboard/invoices/${ticket.invoice.id}`}
                  className="mt-2 block rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-slate-700"
                >
                  View invoice {ticket.invoice.number}
                </Link>
              ) : (
                <form action={createInvoice} className="mt-2 space-y-2">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <div>
                    <Label>Discount (optional)</Label>
                    <Input name="discount" type="number" step="0.01" min="0" defaultValue="0" />
                  </div>
                  <Button type="submit" className="w-full">Issue invoice</Button>
                </form>
              )}
            </div>
          </Card>

          {ticket.whatsappLogs.length > 0 && (
            <Card>
              <CardHeader title="WhatsApp" />
              <ul className="divide-y divide-slate-100">
                {ticket.whatsappLogs.map((w) => (
                  <li key={w.id} className="p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <Badge
                        className={
                          w.status === "SENT"
                            ? "bg-emerald-100 text-emerald-700"
                            : w.status === "SKIPPED"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                        }
                      >
                        {w.status === "SKIPPED" ? "send manually" : w.status.toLowerCase()}
                      </Badge>
                      <span className="text-slate-400">{fmtDateTime(w.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-slate-500 select-all">{w.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <p className="text-xs text-slate-400">
            Created {fmtDateTime(ticket.createdAt)} by {ticket.createdBy.name}
            {ticket.closedAt && <> · Closed {fmtDateTime(ticket.closedAt)}</>}
          </p>
        </div>
      </div>
    </div>
  );
}
