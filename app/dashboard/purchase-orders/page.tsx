import { redirect } from "next/navigation";

export default function PurchaseOrdersPage() {
  redirect("/dashboard/inventory?tab=orders");
}
