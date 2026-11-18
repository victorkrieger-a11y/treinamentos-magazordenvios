import Link from "next/link";
import { Award, CheckCircle2, ClipboardCheck, Gauge, ListChecks, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { CategoryChart, EvolutionChart } from "@/components/charts/charts";
import { AssignmentCard } from "@/components/quiz/assignment-card";
import { ClassificationBadge, TrendIndicator } from "@/components/common/status-badges";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset } from "@/lib/data/performance";
import { isPending, loadMyAssignments } from "@/lib/data/my-assignments";
import { categoryPerformance, sortByCompletion } from "@/lib/domain/analytics";
import { formatPercent, formatScore, formatShortDate } from "@/lib/domain/format";
import type { SessionContext } from "@/lib/auth/session";

export async function CollaboratorDashboard({ session }: { session: SessionContext }) {
  const supabase = await createClient();
  const [assignments, ds] = await Promise.all([
    loadMyAssignments(supabase, session.userId),
    loadPerformanceDataset(supabase, { collaboratorIds: [session.userId] }),
  ]);
  const pending = assignments.filter(isPending).sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  const stats = ds.statsByCollaborator.get(session.userId);
  const attempts = sortByCompletion(ds.attempts);
  const categories = categoryPerformance(ds.answers, ds.categories, ds.settings.minAnswersForDiagnosis);

  return (
    <div className="grid gap-6">
      <PageHeader title={`Olá, ${session.profile.full_name.split(" ")[0]}!`} description="Acompanhe suas avaliações, resultados e evolução no treinamento Magazord Envios." />

      <Section
        title={pending.length ? `Você tem ${pending.length} avaliação(ões) pendente(s)` : "Avaliações pendentes"}
        description={pending.length ? "Conclua dentro do prazo. Seu progresso é salvo automaticamente." : undefined}
        className={pending.length ? "border-mz-red/25" : undefined}
        actions={<Link href="/minhas-avaliacoes" className="text-xs font-medium text-mz-red-strong hover:underline">Ver todas</Link>}
      >
        {pending.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nenhuma avaliação pendente" description="Quando uma nova avaliação for enviada, ela aparecerá aqui." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((a) => <AssignmentCard key={a.id} a={a} highlight />)}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Gauge} label="Minha média" value={formatScore(stats?.average)} accent="red" hint={stats?.average !== null && stats?.average !== undefined ? <ClassificationBadge score={stats.average} /> : "Sem avaliações concluídas"} />
        <KpiCard icon={Award} label="Última nota" value={formatScore(stats?.lastScore)} accent="neutral" hint={stats ? <TrendIndicator trend={stats.trend} delta={stats.delta} /> : undefined} />
        <KpiCard icon={ClipboardCheck} label="Avaliações concluídas" value={stats?.count ?? 0} accent="green" />
        <KpiCard icon={Target} label="Aprovação" value={formatPercent(stats?.approvalRate)} accent="blue" hint={`Meta: ${formatScore(ds.settings.passingScore)} pontos`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Minha evolução" description="Nota de cada avaliação concluída">
          <EvolutionChart passingScore={ds.settings.passingScore} data={attempts.map((a) => ({ label: formatShortDate(a.completedAt), score: a.score, title: a.quizTitle }))} />
        </Section>
        <Section title="Desempenho por categoria" actions={<Button asChild variant="outline" size="sm"><Link href="/meu-desempenho"><ListChecks /> Detalhes</Link></Button>}>
          <CategoryChart passingScore={ds.settings.passingScore} data={categories.map((c) => ({ name: c.name, rate: c.rate, total: c.total }))} />
        </Section>
      </div>
    </div>
  );
}
