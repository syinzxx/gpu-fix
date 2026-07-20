import { Badge } from "@/components/ui";
import {
  STAFF_STATUS_COLORS,
  STAFF_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_STATUS_LABELS,
  PRIORITY_COLORS,
  type StaffStatus,
  type CustomerStatus,
} from "@/lib/constants";

export function StaffStatusBadge({ status }: { status: string }) {
  const s = status as StaffStatus;
  return (
    <Badge className={STAFF_STATUS_COLORS[s] ?? "bg-slate-100 text-slate-600"}>
      {STAFF_STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

export function CustomerStatusBadge({ status }: { status: string }) {
  const s = status as CustomerStatus;
  return (
    <Badge className={CUSTOMER_STATUS_COLORS[s] ?? "bg-slate-100 text-slate-600"}>
      {CUSTOMER_STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "NORMAL") return null;
  return <Badge className={PRIORITY_COLORS[priority] ?? "bg-slate-100 text-slate-600"}>{priority}</Badge>;
}
