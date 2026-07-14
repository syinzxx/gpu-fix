import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { Button, Input, Label, Card } from "@/components/ui";

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: (formData.get("callbackUrl") as string) || "/dashboard",
    });
  } catch (e) {
    if (e instanceof AuthError) redirect("/login?error=1");
    throw e; // NEXT_REDIRECT on success
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-cyan-400" />
        <div className="p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-lg shadow-md shadow-violet-500/25">
            ⚡
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to the {process.env.SHOP_NAME ?? "GPU Fix Shop"} dashboard.
          </p>

          {params.error && (
            <div className="mt-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-rose-100">
              Email or password doesn&rsquo;t match. Try again.
            </div>
          )}

          <form action={loginAction} className="mt-6 space-y-4">
            <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? ""} />
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@shop.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full py-2.5">
              Sign in
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
