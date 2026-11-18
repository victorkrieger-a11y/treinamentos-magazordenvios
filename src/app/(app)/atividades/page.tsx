import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadActivity } from "@/lib/data/activity";

export const metadata: Metadata = { title: "Atividades" };

const PAGE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ antes?: string }> }) {
  const { profile } = await requireSession(["supervisor", "guardian"]);
  const { antes } = await searchParams;
  const before = antes && /^\d+$/.test(antes) ? Number(antes) : undefined;
  const supabase = await createClient();
  const items = await loadActivity(supabase, { limit: PAGE, before });
  return (
    <>
      <PageHeader
        title="Atividades e logs"
        description={profile.role === "supervisor" ? "Registro de todas as ações administrativas relevantes (somente leitura)." : "Eventos relacionados à sua equipe."}
      />
      <Section>
        <ActivityFeed items={items} />
        <div className="mt-6 flex gap-2">
          {before && <Button asChild variant="outline" size="sm"><Link href="/atividades">Mais recentes</Link></Button>}
          {items.length === PAGE && <Button asChild variant="outline" size="sm"><Link href={`/atividades?antes=${items.at(-1)!.id}`}>Mais antigas</Link></Button>}
        </div>
      </Section>
    </>
  );
}
