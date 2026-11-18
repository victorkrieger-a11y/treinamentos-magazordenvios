import type { Metadata } from "next";
import { Award, ClipboardCheck, Gauge, Target } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { TrendIndicator } from "@/components/common/status-badges";
import { PerformanceDetail } from "@/components/dashboard/performance-detail";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset, loadReinforcement } from "@/lib/data/performance";
import { formatPercent, formatScore } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Meu desempenho" };

export default async function MyPerformancePage() {
  const { userId } = await requireSession(["collaborator"]);
  const supabase = await createClient();
  const [ds, reinforcement] = await Promise.all([loadPerformanceDataset(supabase, { collaboratorIds: [userId] }), loadReinforcement(supabase, userId)]);
  const s = ds.statsByCollaborator.get(userId);
  return (
    <div className="grid gap-6">
      <PageHeader title="Meu desempenho" description="Sua evolução, os assuntos que você domina e onde vale reforçar os estudos." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Gauge} label="Média geral" value={formatScore(s?.average)} accent="red" />
        <KpiCard icon={Award} label="Última nota" value={formatScore(s?.lastScore)} hint={s ? <TrendIndicator trend={s.trend} delta={s.delta} /> : undefined} accent="neutral" />
        <KpiCard icon={ClipboardCheck} label="Avaliações concluídas" value={s?.count ?? 0} accent="green" />
        <KpiCard icon={Target} label="Aprovação" value={formatPercent(s?.approvalRate)} hint={`Meta: ${formatScore(ds.settings.passingScore)}`} accent="blue" />
      </div>
      <PerformanceDetail ds={ds} collaboratorId={userId} reinforcement={reinforcement} subject="voce" />
    </div>
  );
}
