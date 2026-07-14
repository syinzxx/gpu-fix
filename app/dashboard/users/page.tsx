import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUser, toggleUserActive } from "@/app/actions/admin";
import { ROLES } from "@/lib/constants";
import { Button, Input, Label, Select, Card, CardHeader, Table, Th, Td, Badge } from "@/components/ui";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const users = await db.user.findMany({
    include: { _count: { select: { assignedTickets: { where: { status: { not: "CLOSED" } } } } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Staff</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="All staff" />
            <Table>
              <thead>
                <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Open tickets</Th><Th>Status</Th><Th></Th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <Td className="font-medium">{u.name}</Td>
                    <Td>{u.email}</Td>
                    <Td><Badge className="bg-slate-100 text-slate-600">{u.role}</Badge></Td>
                    <Td>{u._count.assignedTickets}</Td>
                    <Td>
                      <Badge className={u.active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                        {u.active ? "active" : "disabled"}
                      </Badge>
                    </Td>
                    <Td>
                      {u.id !== session.user.id && (
                        <form action={toggleUserActive}>
                          <input type="hidden" name="id" value={u.id} />
                          <Button size="sm" variant={u.active ? "danger" : "secondary"} type="submit">
                            {u.active ? "Disable" : "Enable"}
                          </Button>
                        </form>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Add staff member" />
          <form action={createUser} className="space-y-3 p-5">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">Password * (min 6 chars)</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select id="role" name="role" defaultValue="TECHNICIAN">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="w-full">Create account</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
