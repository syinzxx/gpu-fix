"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { TicketSlideOver, type SlideOverTicket, type Technician } from "@/components/ticket-slide-over";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Badge, Table, Th, Td } from "@/components/ui";
import { etaUrgency, fmtDate, cn } from "@/lib/utils";

export function TicketsClient({
  tickets,
  technicians,
  emptyMessage,
  labels,
}: {
  tickets: SlideOverTicket[];
  technicians: Technician[];
  emptyMessage: string;
  labels: {
    code: string;
    device: string;
    customer: string;
    status: string;
    assigned: string;
    eta: string;
    received: string;
    unassigned: string;
  };
}) {
  const [selected, setSelected] = useState<SlideOverTicket | null>(null);
  const close = useCallback(() => setSelected(null), []);

  // Keep selected ticket in sync with refreshed data after mutations
  useEffect(() => {
    if (!selected) return;
    const updated = tickets.find((t) => t.id === selected.id);
    if (updated) setSelected(updated);
  }, [tickets]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {tickets.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            ·
          </div>
          <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{labels.code}</Th>
              <Th>{labels.device} · {labels.customer}</Th>
              <Th>{labels.status}</Th>
              <Th>{labels.assigned}</Th>
              <Th>{labels.eta}</Th>
              <Th>{labels.received}</Th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => {
              const urgency = etaUrgency(ticket.etaDate);
              const isSelected = selected?.id === ticket.id;
              return (
                <tr
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className={cn(
                    "cursor-pointer border-l-2 hover:bg-slate-50",
                    urgency === "overdue" && "border-l-red-400 bg-red-50/40 hover:bg-red-50/60",
                    urgency === "today" && "border-l-amber-400 bg-amber-50/30 hover:bg-amber-50/50",
                    urgency !== "overdue" && urgency !== "today" && "border-l-transparent",
                    isSelected && "ring-1 ring-inset ring-violet-200",
                  )}
                >
                  <Td onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/dashboard/tickets/${ticket.id}`}
                      className="font-mono font-semibold text-violet-700 hover:underline"
                    >
                      {ticket.code}
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {ticket.brand} {ticket.model}
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <span className="block text-xs text-slate-400">
                      {ticket.customer.name}
                      <span className="ms-1 text-slate-300">{ticket.customer.phone}</span>
                    </span>
                  </Td>
                  <Td><StatusBadge status={ticket.status} /></Td>
                  <Td>
                    {ticket.assignedTo?.name ?? (
                      <Badge className="bg-slate-100 text-slate-600">{labels.unassigned}</Badge>
                    )}
                  </Td>
                  <Td><EtaCell date={ticket.etaDate} /></Td>
                  <Td className="text-xs text-slate-400">
                    {fmtDate(ticket.createdAt)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {selected && (
        <TicketSlideOver
          ticket={selected}
          technicians={technicians}
          onClose={close}
        />
      )}
    </>
  );
}

function EtaCell({ date }: { date: Date | null }) {
  const urgency = etaUrgency(date);
  if (urgency === "none") return <span className="text-slate-300">—</span>;
  const label =
    urgency === "overdue" ? "Overdue" :
    urgency === "today" ? "Due today" :
    fmtDate(date);
  const color =
    urgency === "overdue" ? "text-red-600 font-semibold" :
    urgency === "today" ? "text-amber-600 font-semibold" :
    "text-emerald-600";
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", color)}>
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}
