import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Gauge, Plus, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { CategoryChart, CompletedChart, ScoreTrendChart } from "@/components/charts/charts";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { RankingTable } from "@/components/dashboard/ranking-table";
import { AttentionList } from "@/components/dashboard/attention-list";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset } from "@/lib/data/performance";
import { loadActivity } from "@/lib/data/activity";
import { FEED_ACTIONS } from "@/lib/domain/activity";
import { resolvePeriod } from "@/lib/domain/periods";
import {
  attentionAlerts,
  categoryPerformance,
  pickGranularity,
  rankingRows,
  scoreTimeline,
  teamKpis,
} from "@/lib/domain/analytics";
import { formatPercent, formatScore } from "@/lib/domain/format";
import type { SessionContext } from "@/lib/auth/session";

export async function StaffDashboard({ session, params }: { session: SessionContext; params: { periodo?: string; de?: string; ate?: string } }) {
  const isSupervisor = session.profile.role === "supervisor";
  const period = resolvePeriod(params, "30d");
  const supabase = await createClient();

  // Dados do período (gráficos/KPIs) e dados completos (situação atual por colaborador).
  const [ds, full, activity] = await Promise.all([
    loadPerformanceDataset(supabase, { from: period.from, to: period.to }),
    loadPerformanceDataset(supabase),
    loadActivity(supabase, { limit: 12, actions: FEED_ACTIONS }),
  ]);
  const { settings } = ds;

  const kpis = teamKpis({ ...ds, statsByCollaborator: full.statsByCollaborator, passingScore: settings.passingScore, attentionScore: settings.attentionScore });
  const pendingNow = teamKpis({ ...full, statsByCollaborator: full.statsByCollaborator, passingScore: settings.passingScore, attentionScore: settings.attentionScore }).pending;
  const timeline = scoreTimeline(ds.attempts, settings.passingScore, pickGranularity(period.from, period.to, ds.attempts));
  const categories = categoryPerformance(ds.answers, ds.categories, 1);
  const alerts = attentionAlerts({ ...full, passingScore: settings.passingScore, attentionScore: settings.attentionScore });
  const ranking = rankingRows(full.collaborators.filter((c) => c.status !== "inactive"), full.statsByCollaborator);

  const firstName = session.profile.full_name.split(" ")[0];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={isSupervisor ? "Painel geral" : "Painel da equipe"}
        description={
          isSupervisor
            ? `Olá, ${firstName}. Visão consolidada do desempenho de toda a operação.`
            : `Olá, ${firstName}. Acompanhamento dos ${full.collaborators.length} colaborador(es) sob sua responsabilidade.`
        }
        actions={
          <>
            <PeriodFilter value={period.key} from={params.de} to={params.ate} />
            <Button asChild>
              <Link href="/avaliacoes/nova"><Plus /> Nova avaliação</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <KpiCard icon={Users} label="Colaboradores ativos" value={kpis.activeCollaborators} accent="neutral" />
        <KpiCard icon={Send} label="Avaliações enviadas" value={kpis.assignmentsSent} hint={period.label} accent="blue" />
        <KpiCard icon={Clock} label="Avaliações pendentes" value={pendingNow} hint="Situação atual" accent="yellow" />
        <KpiCard icon={ClipboardCheck} label="Avaliações concluídas" value={kpis.completed} hint={period.label} accent="green" />
        <KpiCard icon={Gauge} label="Média geral" value={formatScore(kpis.average)} hint={`${ds.attempts.length} resultado(s)`} accent="red" />
        <KpiCard icon={CheckCircle2} label="Aprovação" value={formatPercent(kpis.approvalRate)} hint={`Meta: ${formatScore(settings.passingScore)} pontos`} accent="green" />
        <KpiCard icon={AlertTriangle} label="Precisam de reforço" value={kpis.needReinforcement} hint={`Última nota < ${formatScore(settings.attentionScore)}`} accent="red" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Section title="Evolução das notas" description={`Média e percentual de aprovação · ${period.label}`} className="xl:col-span-2">
          <ScoreTrendChart data={timeline} passingScore={settings.passingScore} />
        </Section>
        <Section title="Avaliações concluídas" description={`Quantidade por período · ${period.label}`}>
          <CompletedChart data={timeline} />
        </Section>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Section title="Desempenho por categoria" description="Aproveitamento (%) nas respostas do período" className="xl:col-span-2">
          <CategoryChart data={categories.map((c) => ({ name: c.name, rate: c.rate, total: c.total }))} passingScore={settings.passingScore} />
        </Section>
        <Section title="Atenção necessária" description="Identificado automaticamente a partir dos resultados" id="atencao">
          <AttentionList alerts={alerts} limit={5} />
        </Section>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Section title="Desempenho dos colaboradores" description="Ferramenta administrativa de acompanhamento — não divulgar publicamente." className="xl:col-span-2">
          <RankingTable rows={ranking} passingScore={settings.passingScore} showGuardian={isSupervisor} />
        </Section>
        <Section
          title="Atividade recente"
          actions={<Link href="/atividades" className="text-xs font-medium text-mz-red-strong hover:underline">Ver tudo</Link>}
        >
          <ActivityFeed items={activity} />
        </Section>
      </div>
    </div>
  );
}
