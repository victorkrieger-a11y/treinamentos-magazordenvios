"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/components/layout/nav-config";
import type { UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

export function SidebarNav({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className="grid gap-0.5">
      {NAV[role].map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-mz-red-soft text-mz-red-strong" : "text-mz-gray-dark hover:bg-muted hover:text-mz-chumbo",
            )}
          >
            <item.icon className={cn("size-[18px] shrink-0", active ? "text-mz-red" : "text-mz-gray group-hover:text-mz-chumbo")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
