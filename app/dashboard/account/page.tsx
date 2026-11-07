import { ChangePasswordForm } from "@/components/change-password-form";
import { Card, CardHeader } from "@/components/ui";
import { getT } from "@/lib/locale";

export default async function AccountPage() {
  const t = await getT();
  return (
    <div className="max-w-md space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.passwordChange}</h1>
      <Card>
        <CardHeader title={t.passwordChange} />
        <ChangePasswordForm t={t} />
      </Card>
    </div>
  );
}
