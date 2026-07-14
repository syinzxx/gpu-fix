import { db } from "@/lib/db";
import { createTicket } from "@/app/actions/tickets";
import { DEVICE_TYPES, PRIORITIES } from "@/lib/constants";
import { Button, Input, Label, Select, Textarea, Card, CardHeader } from "@/components/ui";

export default async function NewTicketPage() {
  const technicians = await db.user.findMany({
    where: { active: true, role: { in: ["TECHNICIAN", "ADMIN"] } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">New Ticket</h1>

      <form action={createTicket} className="space-y-5">
        <Card>
          <CardHeader title="Customer" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="customerName">Name *</Label>
              <Input id="customerName" name="customerName" required placeholder="Customer name" />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" name="phone" required placeholder="+20 1x xxxx xxxx" />
              <p className="mt-1 text-xs text-slate-400">Existing customers are matched by phone.</p>
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp (if different)</Label>
              <Input id="whatsapp" name="whatsapp" placeholder="Defaults to phone" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="Optional" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Device" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="deviceType">Type</Label>
              <Select id="deviceType" name="deviceType" defaultValue="GPU">
                {DEVICE_TYPES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="brand">Brand *</Label>
              <Input id="brand" name="brand" required placeholder="e.g. ASUS" />
            </div>
            <div>
              <Label htmlFor="model">Model *</Label>
              <Input id="model" name="model" required placeholder="e.g. RTX 3080 TUF" />
            </div>
            <div>
              <Label htmlFor="serialNumber">Serial number</Label>
              <Input id="serialNumber" name="serialNumber" placeholder="Optional" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="accessories">Accessories received</Label>
              <Input id="accessories" name="accessories" placeholder="e.g. original box, power cables" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="issue">Reported issue *</Label>
              <Textarea id="issue" name="issue" required rows={3} placeholder="Describe the problem the customer reported" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Intake" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" defaultValue="NORMAL">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="etaDate">Estimated completion</Label>
              <Input id="etaDate" name="etaDate" type="date" />
            </div>
            <div>
              <Label htmlFor="assignedToId">Assign technician</Label>
              <Select id="assignedToId" name="assignedToId" defaultValue="">
                <option value="">Unassigned (shared queue)</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-start gap-2 sm:col-span-3">
              <input type="checkbox" id="isWarrantyReturn" name="isWarrantyReturn"
                className="mt-0.5 accent-violet-600" />
              <div>
                <label htmlFor="isWarrantyReturn" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Warranty return
                </label>
                <p className="text-xs text-slate-400">Check if this device is being returned under warranty from a previous repair.</p>
              </div>
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="warrantyTicketId">Original ticket code (if warranty return)</Label>
              <Input id="warrantyTicketId" name="warrantyTicketId" placeholder="e.g. GPU-4F7K2" />
            </div>
          </div>
        </Card>

        <Button type="submit" className="w-full py-3">
          Create ticket &amp; notify customer
        </Button>
      </form>
    </div>
  );
}
