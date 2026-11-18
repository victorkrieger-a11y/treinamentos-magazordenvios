"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markNotificationsRead } from "@/server/actions/notifications";
import { formatRelative } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export type BellNotification = { id: string; title: string; message: string; link: string | null; createdAt: string; read: boolean };

export function NotificationBell({ items, unread }: { items: BellNotification[]; unread: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-mz-red px-1 text-[10px] font-bold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-mz-red-strong hover:underline disabled:opacity-50"
              disabled={pending}
              onClick={() => start(async () => { await markNotificationsRead(); router.refresh(); })}
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhuma notificação.</li>}
          {items.map((n) => (
            <li key={n.id} className="border-b last:border-0">
              <Link
                href={n.link ?? "/notificacoes"}
                onClick={() => !n.read && markNotificationsRead([n.id])}
                className={cn("block px-4 py-3 transition-colors hover:bg-muted", !n.read && "bg-mz-red-soft/40")}
              >
                <p className="flex items-center gap-2 text-sm font-medium text-mz-chumbo">
                  {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-mz-red" aria-label="Não lida" />}
                  {n.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-[11px] text-mz-gray">{formatRelative(n.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t px-4 py-2 text-center">
          <Link href="/notificacoes" className="text-xs font-medium text-mz-red-strong hover:underline">Ver todas</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
