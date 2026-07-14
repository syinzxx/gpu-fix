import { Badge } from "@/components/ui";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_COLORS,
  type TicketStatus,
} from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const s = status as TicketStatus;
  return (
    <Badge className={STATUS_COLORS[s] ?? "bg-slate-100 text-slate-600"}>
      {STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "NORMAL") return null;
  return <Badge className={PRIORITY_COLORS[priority] ?? "bg-slate-100 text-slate-600"}>{priority}</Badge>;
}
