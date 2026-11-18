import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { MarkAllRead } from "@/components/layout/mark-all-read";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").order("visible_at", { ascending: false }).limit(100);
  const items = data ?? [];
  return (
    <>
      <PageHeader title="Notificações" description="Avisos internos da plataforma." actions={items.some((n) => !n.read_at) && <MarkAllRead />} />
      <Section contentClassName="p-0">
        {items.length === 0 ? (
          <EmptyState icon={Bell} title="Nenhuma notificação" />
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className={cn("flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:justify-between", !n.read_at && "bg-mz-red-soft/30")}>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-mz-chumbo">{!n.read_at && <span className="size-2 rounded-full bg-mz-red" aria-label="Não lida" />}{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  {n.link && <Link href={n.link} className="mt-1 inline-block text-xs font-medium text-mz-red-strong hover:underline">Abrir</Link>}
                </div>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={n.visible_at}>{formatDateTime(n.visible_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
