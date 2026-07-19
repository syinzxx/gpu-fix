import { getSettings } from "@/lib/settings";
import { saveSettings } from "@/app/actions/admin";
import { getT } from "@/lib/locale";
import { Button, Input, Label, Card, CardHeader } from "@/components/ui";

export default async function SettingsPage() {
  const [settings, t] = await Promise.all([getSettings(), getT()]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="silk-label text-violet-600">admin</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.settings}</h1>
        <p className="mt-1 text-sm text-slate-400">{t.shopInfo}</p>
      </div>

      <Card>
        <CardHeader title={t.shopInfo} />
        <form action={saveSettings} className="space-y-4 p-5">
          <div>
            <Label htmlFor="shopName">{t.shopName}</Label>
            <Input id="shopName" name="shopName" required defaultValue={settings.shopName} placeholder="GPU Fix Shop" />
          </div>
          <div>
            <Label htmlFor="shopAddress">{t.address}</Label>
            <Input id="shopAddress" name="shopAddress" defaultValue={settings.shopAddress} placeholder="123 Main St, Cairo" />
          </div>
          <div>
            <Label htmlFor="shopPhone">{t.phone}</Label>
            <Input id="shopPhone" name="shopPhone" defaultValue={settings.shopPhone} placeholder="+20 1x xxxx xxxx" />
          </div>
          <div>
            <Label htmlFor="shopHours">{t.hours}</Label>
            <Input id="shopHours" name="shopHours" defaultValue={settings.shopHours} placeholder="Sat–Thu 10:00–20:00" aria-describedby="shopHours-hint" />
            <p id="shopHours-hint" className="mt-1 text-xs text-slate-400">{t.hoursHint}</p>
          </div>
          <Button type="submit" variant="primary" className="w-full">{t.saveSettings}</Button>
        </form>
      </Card>
    </div>
  );
}
