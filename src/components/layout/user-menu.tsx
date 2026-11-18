"use client";

import { LogOut, UserRound } from "lucide-react";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/server/actions/auth";
import { initials } from "@/lib/domain/format";

export function UserMenu({ name, email, roleLabel }: { name: string; email: string; roleLabel: string }) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" aria-label="Menu do usuário">
        <span className="flex size-8 items-center justify-center rounded-full bg-mz-chumbo text-xs font-semibold text-white">{initials(name)}</span>
        <span className="hidden leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-sm font-semibold text-mz-chumbo">{name}</span>
          <span className="block text-xs text-muted-foreground">{roleLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold text-mz-chumbo">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2">
          <UserRound className="size-4" /> Perfil: {roleLabel}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-mz-red-strong focus:text-mz-red-strong"
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            start(() => signOut());
          }}
        >
          <LogOut className="size-4" /> {pending ? "Saindo..." : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
