"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: string };

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-violet-50 text-violet-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <span className={cn("text-base", !active && "opacity-70")}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
