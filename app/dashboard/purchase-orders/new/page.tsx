import { redirect } from "next/navigation";

export default function NewPurchaseOrderPage() {
  redirect("/dashboard/inventory?tab=orders");
}
