import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Download, Gauge, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState } from "@/components/common/empty-state";
import { AssignmentStatusBadge, ClassificationBadge, ScoreText, TrendIndicator } from "@/components/common/status-badges";
import { CategoryChart, ScoreTrendChart } from "@/components/charts/charts";
import { ReportFilters } from "@/components/dashboard/report-filters";
import { PrintButton } from "@/components/dashboard/print-button";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildReport, type ReportParams } from "@/lib/data/reports";
import { loadGuardians } from "@/lib/data/people";
import { formatDate, formatDateTime, formatPercent, formatScore } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportParams> }) {
  const { profile } = await requireSession(["supervisor", "guardian"]);
  const params = await searchParams;
  const supabase = await createClient();
  const [report, guardians] = await Promise.all([buildReport(supabase, params), profile.role === "supervisor" ? loadGuardians(supabase) : Promise.resolve([])]);
  const { settings } = report;
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  return (
    <div className="grid gap-6">
      <PageHeader
        title={profile.role === "supervisor" ? "Relatórios" : "Resultados da equipe"}
        description={`Período: ${report.period.label}. Considera somente avaliações concluídas (melhor tentativa) e exclui canceladas.`}
        actions={
          <div className="flex gap-2 print:hidden">
            <PrintButton />
            <Button asChild><a href={`/api/relatorios/csv${qs ? `?${qs}` : ""}`}><Download /> Exportar CSV</a></Button>
          </div>
        }
      />
      <Section className="print:hidden">
        <ReportFilters
          showGuardian={profile.role === "supervisor"}
          collaborators={report.options.collaborators.map((c) => ({ id: c.id, label: c.name }))}
          guardians={guardians.map((g) => ({ id: g.id, label: g.fullName }))}
          quizzes={report.options.quizzes.map((q) => ({ id: q.id, label: q.title }))}
          categories={report.options.categories.map((c) => ({ id: c.id, label: c.name }))}
        />
      </Section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Gauge} label="Média geral" value={formatScore(report.summary.average)} accent="red" />
        <KpiCard icon={CheckCircle2} label="Percentual de aprovação" value={formatPercent(report.summary.approvalRate)} hint={`Meta: ${formatScore(settings.passingScore)} pontos`} accent="green" />
        <KpiCard icon={ClipboardCheck} label="Avaliações concluídas" value={report.summary.completed} accent="neutral" />
        <KpiCard icon={Users} label="Colaboradores avaliados" value={report.summary.collaborators} accent="blue" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Evolução de desempenho"><ScoreTrendChart data={report.timeline} passingScore={settings.passingScore} /></Section>
        <Section title="Categorias com maior dificuldade" description="Aproveitamento por categoria (ordem crescente)">
          <CategoryChart data={report.hardestCategories.map((c) => ({ name: c.name, rate: c.rate, total: c.total }))} passingScore={settings.passingScore} />
        </Section>
      </div>

      <Section title="Questões com maior índice de erro" contentClassName="p-0">
        {report.worstQuestions.length === 0 ? (
          <EmptyState title="Nenhum erro registrado nos filtros selecionados" />
        ) : (
          <ol className="divide-y">
            {report.worstQuestions.map((w) => (
              <li key={w.questionId} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm text-mz-chumbo">{w.question?.code && <span className="mr-1 font-semibold">{w.question.code}.</span>}{w.question?.statement}</p>
                  <p className="text-xs text-muted-foreground">{w.question?.topic}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full bg-mz-red" style={{ width: `${w.errorRate}%` }} /></div>
                  <span className="tabular w-36 text-right text-xs font-medium text-mz-red-strong">{formatPercent(w.errorRate)} de erro ({w.wrong}/{w.total})</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Desempenho por colaborador" contentClassName="p-0">
        {report.perCollaborator.length === 0 ? <EmptyState title="Sem resultados" /> : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Desempenho por colaborador</caption>
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Colaborador</th><th className="px-3 py-3 font-semibold">Guardião</th>
                <th className="px-3 py-3 text-right font-semibold">Média</th><th className="px-3 py-3 text-right font-semibold">Avaliações</th>
                <th className="px-3 py-3 text-right font-semibold">Aprovação</th><th className="px-3 py-3 font-semibold">Evolução</th>
              </tr></thead>
              <tbody>
                {report.perCollaborator.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5"><Link href={`/colaboradores/${r.id}`} className="font-medium hover:text-mz-red-strong hover:underline">{r.name}</Link></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.guardian ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right"><ScoreText score={r.stats.average} passing={settings.passingScore} /></td>
                    <td className="tabular px-3 py-2.5 text-right">{r.stats.count}</td>
                    <td className="px-3 py-2.5 text-right">{formatPercent(r.stats.approvalRate)}</td>
                    <td className="px-3 py-2.5"><TrendIndicator trend={r.stats.trend} delta={r.stats.evolution} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Avaliações (${report.rows.length})`} contentClassName="p-0">
        {report.rows.length === 0 ? <EmptyState title="Nenhuma avaliação nos filtros selecionados" /> : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">Avaliações</caption>
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Colaborador</th><th className="px-3 py-3 font-semibold">Avaliação</th>
                <th className="px-3 py-3 font-semibold">Envio</th><th className="px-3 py-3 font-semibold">Conclusão</th>
                <th className="px-3 py-3 text-right font-semibold">Nota</th><th className="px-3 py-3 text-right font-semibold">Acertos</th>
                <th className="px-3 py-3 font-semibold">Classificação</th><th className="px-3 py-3 font-semibold">Status</th>
              </tr></thead>
              <tbody>
                {report.rows.slice(0, 500).map((r) => (
                  <tr key={r.assignmentId} className="border-b last:border-0">
                    <td className="px-5 py-2.5">{r.collaborator}</td>
                    <td className="px-3 py-2.5">{r.attemptId ? <Link href={`/resultado/${r.attemptId}`} className="hover:text-mz-red-strong hover:underline">{r.quiz}</Link> : r.quiz}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(r.assignedAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.completedAt ? formatDateTime(r.completedAt) : "—"}</td>
                    <td className="px-3 py-2.5 text-right"><ScoreText score={r.score} passing={settings.passingScore} /></td>
                    <td className="tabular px-3 py-2.5 text-right">{r.correct !== null ? `${r.correct}/${(r.correct ?? 0) + (r.incorrect ?? 0)}` : "—"}</td>
                    <td className="px-3 py-2.5">{r.score !== null ? <ClassificationBadge score={r.score} /> : "—"}</td>
                    <td className="px-3 py-2.5"><AssignmentStatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length > 500 && <p className="px-5 py-3 text-xs text-muted-foreground">Exibindo 500 de {report.rows.length}. Exporte o CSV para a lista completa.</p>}
          </div>
        )}
      </Section>
    </div>
  );
}
