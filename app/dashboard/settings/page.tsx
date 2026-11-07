import { getSettings } from "@/lib/settings";
import { saveSettings } from "@/app/actions/admin";
import { getT } from "@/lib/locale";
import { Button, Input, Label, Card, CardHeader } from "@/components/ui";

export default async function SettingsPage() {
  const [settings, t] = await Promise.all([getSettings(), getT()]);

  const waVars: Record<string, boolean> = {
    WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN:    !!process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_VERIFY_TOKEN:    !!process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET:      !!process.env.WHATSAPP_APP_SECRET,
    NEXT_PUBLIC_APP_URL:      !!process.env.NEXT_PUBLIC_APP_URL,
  };
  const waOk = Object.values(waVars).every(Boolean);
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.com"}/api/whatsapp/webhook`;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="silk-label text-violet-600">admin</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{t.settings}</h1>
        <p className="mt-1 text-sm text-slate-400">{t.shopInfo}</p>
      </div>

      <form action={saveSettings} className="space-y-6">
        <Card>
          <CardHeader title={t.shopInfo} />
          <div className="space-y-4 p-5">
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
          </div>
        </Card>

        <Card>
          <CardHeader title={t.contactSocial} />
          <div className="space-y-4 p-5">
            <div>
              <Label htmlFor="whatsappNumber">{t.whatsappNumberLabel}</Label>
              <Input
                id="whatsappNumber"
                name="whatsappNumber"
                defaultValue={settings.whatsappNumber}
                placeholder="+20 1x xxxx xxxx"
                aria-describedby="whatsappNumber-hint"
              />
              <p id="whatsappNumber-hint" className="mt-1 text-xs text-slate-400">{t.whatsappNumberHint}</p>
            </div>
            <div>
              <Label htmlFor="socialFacebook">Facebook</Label>
              <Input
                id="socialFacebook"
                name="socialFacebook"
                type="url"
                defaultValue={settings.socialFacebook}
                placeholder="https://facebook.com/yourpage"
                aria-describedby="social-hint"
              />
            </div>
            <div>
              <Label htmlFor="socialYoutube">YouTube</Label>
              <Input
                id="socialYoutube"
                name="socialYoutube"
                type="url"
                defaultValue={settings.socialYoutube}
                placeholder="https://youtube.com/@yourchannel"
                aria-describedby="social-hint"
              />
            </div>
            <div>
              <Label htmlFor="socialTiktok">TikTok</Label>
              <Input
                id="socialTiktok"
                name="socialTiktok"
                type="url"
                defaultValue={settings.socialTiktok}
                placeholder="https://tiktok.com/@yourpage"
                aria-describedby="social-hint"
              />
            </div>
            <div>
              <Label htmlFor="socialDiscord">Discord</Label>
              <Input
                id="socialDiscord"
                name="socialDiscord"
                type="url"
                defaultValue={settings.socialDiscord}
                placeholder="https://discord.gg/yourinvite"
                aria-describedby="social-hint"
              />
              <p id="social-hint" className="mt-1 text-xs text-slate-400">{t.socialHint}</p>
            </div>
          </div>
        </Card>

        <Button type="submit" variant="primary" className="w-full">{t.saveSettings}</Button>
      </form>

      <Card>
        <CardHeader title={t.whatsappApiCard} />
        <div className="space-y-4 p-5">
          <p className="text-xs text-slate-400">{t.whatsappApiDesc}</p>
          <ul className="space-y-2">
            {Object.entries(waVars).map(([key, isSet]) => (
              <li key={key} className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-600">{key}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${isSet ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {isSet ? t.envVarSet : t.envVarMissing}
                </span>
              </li>
            ))}
          </ul>
          <p className={`text-xs font-medium ${waOk ? "text-emerald-700" : "text-amber-600"}`}>
            {waOk ? t.whatsappConfigOk : t.whatsappConfigSkip}
          </p>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">{t.webhookUrlLabel}</p>
            <code className="block select-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200 break-all">
              {webhookUrl}
            </code>
          </div>
        </div>
      </Card>
    </div>
  );
}
