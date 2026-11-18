import { Lightbulb, Target } from "lucide-react";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { CategoryChart, EvolutionChart } from "@/components/charts/charts";
import { ScoreText, TrendIndicator } from "@/components/common/status-badges";
import { HistoryTable, type HistoryRow } from "@/components/tables/history-table";
import type { PerformanceDataset } from "@/lib/data/performance";
import {
  TREND_LABELS,
  buildDiagnosis,
  categoryPerformance,
  sortByCompletion,
  topicDifficulties,
  type ReinforcementItem,
} from "@/lib/domain/analytics";
import { formatPercent, formatShortDate } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

type Reinforcement = ReinforcementItem & { statement: string | null };

/** Evolução, desempenho por categoria, pontos de melhoria e histórico de um colaborador. */
export function PerformanceDetail({
  ds,
  collaboratorId,
  reinforcement,
  subject,
  canOpenResults = true,
}: {
  ds: PerformanceDataset;
  collaboratorId: string;
  reinforcement: Reinforcement[];
  subject: "colaborador" | "voce";
  canOpenResults?: boolean;
}) {
  const { settings } = ds;
  const attempts = sortByCompletion(ds.attempts.filter((a) => a.collaboratorId === collaboratorId));
  const answers = ds.answers.filter((a) => a.collaboratorId === collaboratorId);
  const stats = ds.statsByCollaborator.get(collaboratorId);
  const categories = categoryPerformance(answers, ds.categories, settings.minAnswersForDiagnosis);
  const topics = topicDifficulties(answers, settings.minAnswersForDiagnosis);
  const diagnosis = buildDiagnosis(categories, topics, reinforcement, subject);
  const attemptByAssignment = new Map(attempts.map((a) => [a.assignmentId, a]));

  const history: HistoryRow[] = ds.allAssignments
    .filter((a) => a.collaboratorId === collaboratorId)
    .map((a) => {
      const t = attemptByAssignment.get(a.id);
      return {
        assignmentId: a.id,
        title: a.quizTitle,
        assignedAt: a.assignedAt,
        dueAt: a.dueAt,
        completedAt: t?.completedAt ?? null,
        score: t?.score ?? null,
        correct: t?.correct ?? null,
        incorrect: t ? t.incorrect : null,
        status: a.status,
        attemptId: t?.id ?? null,
        canOpenResult: canOpenResults,
      };
    });

  const topReinforcement = reinforcement.filter((r) => r.wrong > 0).slice(0, 8);

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-5">
        <Section title="Evolução" description={stats ? `${TREND_LABELS[stats.trend]} entre as duas últimas avaliações` : undefined} className="xl:col-span-3">
          <EvolutionChart passingScore={settings.passingScore} data={attempts.map((a) => ({ label: formatShortDate(a.completedAt), score: a.score, title: a.quizTitle }))} />
          {attempts.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Notas por avaliação</caption>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-semibold">Avaliação</th>
                    <th className="py-2 text-right font-semibold">Nota</th>
                    <th className="py-2 pl-4 font-semibold">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a, i) => {
                    const delta = i > 0 ? Math.round((a.score - attempts[i - 1].score) * 100) / 100 : null;
                    return (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-2">{a.quizTitle} <span className="text-xs text-muted-foreground">· {formatShortDate(a.completedAt)}</span></td>
                        <td className="py-2 text-right"><ScoreText score={a.score} passing={settings.passingScore} /></td>
                        <td className="py-2 pl-4">{delta === null ? <span className="text-xs text-muted-foreground">Primeira</span> : <TrendIndicator trend={delta >= 5 ? "up" : delta <= -5 ? "down" : "stable"} delta={delta} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Pontos de melhoria" description="Gerado a partir das questões efetivamente erradas" className="xl:col-span-2">
          <div className={cn("rounded-lg p-3 text-sm", diagnosis.status === "ok" ? "bg-mz-red-soft/60 text-mz-chumbo" : "bg-muted text-mz-gray-dark")}>
            {diagnosis.mainDifficulty && (
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mz-red-strong">
                <Target className="size-3.5" aria-hidden /> Maior dificuldade: {diagnosis.mainDifficulty}
              </p>
            )}
            <p>{diagnosis.summary}</p>
            {diagnosis.topics.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Assuntos que precisam de reforço: {diagnosis.topics.join(", ")}.</p>}
          </div>
          {diagnosis.recommendations.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-mz-chumbo">Recomendações de reforço</p>
              <ul className="grid gap-2">
                {diagnosis.recommendations.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-mz-chumbo">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-mz-yellow" aria-hidden /> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topReinforcement.some((r) => r.statement) && (
            <details className="mt-4 rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-mz-chumbo">Questões erradas ({topReinforcement.length})</summary>
              <ul className="mt-2 grid gap-2">
                {topReinforcement.map((r) => (
                  <li key={r.questionId} className="text-xs text-muted-foreground">
                    <span className="font-medium text-mz-chumbo">{r.topic}</span> — {r.statement ?? "Enunciado disponível após liberação do gabarito."}{" "}
                    <span className="whitespace-nowrap">({r.wrong} erro(s) em {r.total})</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Section>
      </div>

      <Section title="Desempenho por categoria" description={`Categorias com menos de ${settings.minAnswersForDiagnosis} respostas são marcadas como dados insuficientes.`}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Desempenho por categoria</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-semibold">Categoria</th>
                  <th className="py-2 text-right font-semibold">Acertos</th>
                  <th className="py-2 text-right font-semibold">Erros</th>
                  <th className="py-2 text-right font-semibold">Aproveitamento</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.categoryId} className="border-b last:border-0">
                    <td className="py-2">{c.name}</td>
                    <td className="tabular py-2 text-right">{c.correct}</td>
                    <td className="tabular py-2 text-right">{c.wrong}</td>
                    <td className="py-2 text-right">
                      {c.total === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem dados</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {!c.sufficient && <span className="text-[10px] text-muted-foreground">dados insuficientes</span>}
                          <ScoreText score={c.rate} passing={settings.passingScore} />
                          <span className="text-xs text-muted-foreground">%</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {answers.length ? (
            <CategoryChart passingScore={settings.passingScore} data={categories.map((c) => ({ name: c.name, rate: c.rate, total: c.total }))} />
          ) : (
            <EmptyState title="Sem respostas registradas" />
          )}
        </div>
      </Section>

      <Section title="Histórico de avaliações" description={stats ? `Aprovação em ${formatPercent(stats.approvalRate)} das avaliações concluídas` : undefined}>
        <HistoryTable rows={history} passingScore={settings.passingScore} />
      </Section>
    </div>
  );
}
