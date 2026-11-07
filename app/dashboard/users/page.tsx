import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createUser, deleteUser, toggleUserActive } from "@/app/actions/admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ROLES } from "@/lib/constants";
import { Button, Input, Label, Select, Card, CardHeader, Table, Th, Td, Badge } from "@/components/ui";
import { getT } from "@/lib/locale";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [users, t] = await Promise.all([
    db.user.findMany({
      include: { _count: { select: { assignedTickets: { where: { staffStatus: { not: "CLOSED" } } } } } },
      orderBy: { createdAt: "asc" },
    }),
    getT(),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.staff}</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title={t.allStaff} />
            <Table>
              <thead>
                <tr><Th>{t.name}</Th><Th>{t.email}</Th><Th>{t.role}</Th><Th>{t.openTicketsCol}</Th><Th>{t.status}</Th><Th></Th></tr>
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
                        {u.active ? t.active : t.disabled}
                      </Badge>
                    </Td>
                    <Td>
                      {u.id !== session.user.id && (
                        <div className="flex justify-end gap-1.5">
                          <form action={toggleUserActive}>
                            <input type="hidden" name="id" value={u.id} />
                            <Button size="sm" variant={u.active ? "danger" : "secondary"} type="submit">
                              {u.active ? t.disable : t.enable}
                            </Button>
                          </form>
                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <ConfirmSubmitButton
                              size="sm"
                              variant="danger"
                              confirmMessage={`${t.staffDeleteConfirm} ${u.name} (${u.email})\n\n${t.staffDeleteEffect}`}
                            >
                              {t.staffDelete}
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title={t.addStaffMember} />
          <form action={createUser} className="space-y-3 p-5">
            <div>
              <Label htmlFor="name">{t.name} *</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="email">{t.email} *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">{t.passwordMinChars}</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <div>
              <Label htmlFor="role">{t.role}</Label>
              <Select id="role" name="role" defaultValue="TECHNICIAN">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="w-full">{t.createAccount}</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
