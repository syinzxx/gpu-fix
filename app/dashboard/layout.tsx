import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { DashboardNav, type NavItem } from "@/components/dashboard-nav";
import { getSettings } from "@/lib/settings";
import { getLocale, getT } from "@/lib/locale";
import { LangToggle } from "@/components/lang-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { user } = session;
  const [settings, t, locale] = await Promise.all([getSettings(), getT(), getLocale()]);

  const NAV: (NavItem & { adminOnly?: boolean })[] = [
    { href: "/dashboard", label: t.overview, icon: "◈" },
    { href: "/dashboard/tickets", label: t.tickets, icon: "▤" },
    { href: "/dashboard/inventory", label: t.inventory, icon: "▦" },
    { href: "/dashboard/purchase-orders", label: t.purchaseOrders, icon: "⬡" },
    { href: "/dashboard/suppliers", label: t.suppliers, icon: "⬒" },
    { href: "/dashboard/customers", label: t.customers, icon: "◔" },
    { href: "/dashboard/reports", label: t.reports, icon: "◫" },
    { href: "/dashboard/users", label: t.staff, icon: "◍", adminOnly: true },
    { href: "/dashboard/settings", label: t.settings, icon: "⚙", adminOnly: true },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 start-0 flex w-60 flex-col border-e border-slate-200/70 bg-white print:hidden">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 text-sm shadow-md shadow-violet-500/25">
            ⚡
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight text-slate-900">
            {settings.shopName}
          </span>
        </div>

        <DashboardNav
          items={NAV.filter((item) => !item.adminOnly || user.role === "ADMIN").map(
            ({ adminOnly: _adminOnly, ...item }) => item
          )}
        />

        <div className="border-t border-slate-100 p-4">
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
