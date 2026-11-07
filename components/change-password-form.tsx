"use client";

import { useActionState } from "react";
import { changePassword, type PasswordState } from "@/app/actions/account";
import { Button, Input, Label } from "@/components/ui";
import type { Translations } from "@/lib/i18n";

export function ChangePasswordForm({ t }: { t: Translations }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  const errors = {
    wrong: t.passwordWrong,
    short: t.passwordShort,
    mismatch: t.passwordMismatch,
    same: t.passwordSame,
  };

  return (
    <form action={action} className="space-y-3 p-5">
      <div>
        <Label htmlFor="current">{t.passwordCurrent}</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <Label htmlFor="next">{t.passwordNew}</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div>
        <Label htmlFor="repeat">{t.passwordRepeat}</Label>
        <Input id="repeat" name="repeat" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <p role="status" className={state.ok ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-rose-600"}>
        {state.ok ? t.passwordChanged : state.error ? errors[state.error] : ""}
      </p>
      <Button type="submit" className="w-full" disabled={pending}>
        {t.passwordChange}
      </Button>
    </form>
  );
}
