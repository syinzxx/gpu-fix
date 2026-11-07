import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { DashboardNav, type NavItem } from "@/components/dashboard-nav";
import { getSettings } from "@/lib/settings";
import { getLocale, getT } from "@/lib/locale";
import { LangToggle } from "@/components/lang-toggle";
import { BrandMark } from "@/components/icons";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { user } = session;
  const [settings, t, locale] = await Promise.all([getSettings(), getT(), getLocale()]);

  const NAV: (NavItem & { adminOnly?: boolean; roles?: string[] })[] = [
    { href: "/dashboard", label: t.overview, icon: "overview" },
    { href: "/dashboard/tickets", label: t.tickets, icon: "ticket" },
    { href: "/dashboard/inventory", label: t.inventory, icon: "box" },
    { href: "/dashboard/customers", label: t.customers, icon: "users" },
    { href: "/dashboard/reports", label: t.reports, icon: "chart" },
    { href: "/dashboard/expenses", label: t.expenses, icon: "receipt", roles: ["ADMIN", "RECEPTIONIST"] },
    { href: "/dashboard/users", label: t.staff, icon: "staff", adminOnly: true },
    { href: "/dashboard/settings", label: t.settings, icon: "settings", adminOnly: true },
    { href: "/dashboard/whatsapp", label: t.whatsappLogs, icon: "message", roles: ["ADMIN", "RECEPTIONIST"] },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 start-0 flex w-60 flex-col gr-dark border-e border-cyan-400/20 print:hidden">
        <div className="flex items-center px-5 py-5">
          <BrandMark name={settings.shopName} size={34} />
        </div>

        <DashboardNav
          items={NAV.filter(
            (item) => (!item.adminOnly || user.role === "ADMIN") && (!item.roles || item.roles.includes(user.role))
          ).map(({ href, label, icon }) => ({ href, label, icon }))}
        />

        <div className="border-t border-cyan-400/15 p-4">
          <div className="flex items-center justify-between">
            <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
            <LangToggle current={locale} />
          </div>
          <p className="text-xs font-medium text-slate-400">
            {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="mt-2 cursor-pointer text-xs font-semibold text-slate-400 hover:text-rose-500">
              {t.signOut}
            </button>
          </form>
        </div>
      </aside>

      <main className="ms-60 flex-1 p-6 lg:p-8 print:ms-0 print:p-0">{children}</main>
    </div>
  );
}
