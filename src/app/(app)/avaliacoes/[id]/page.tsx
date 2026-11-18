import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, FileText, Gauge, RotateCcw, Users } from "lucide-react";
import { KpiCard } from "@/components/common/kpi-card";
import { Section } from "@/components/common/section";
import { AssignmentStatusBadge, ScoreText } from "@/components/common/status-badges";
import { ToneBadge } from "@/components/common/tone-badge";
import { CancelAssignmentButton, CancelQuizButton } from "@/components/quiz/cancel-buttons";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset } from "@/lib/data/performance";
import { isOpenAssignment, questionErrorRates } from "@/lib/domain/analytics";
import { average, percentage } from "@/lib/domain/scoring";
import { formatDate, formatDateTime, formatDuration, formatPercent, formatScore } from "@/lib/domain/format";
import { DIFFICULTY_LABELS, QUIZ_MODE_LABELS } from "@/lib/domain/status";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Avaliação" };

type Snapshot = { statement: string; category_name: string; topic: string; difficulty: "facil" | "media" | "dificil"; code: string | null };

export default async function QuizDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireSession(["supervisor", "guardian"]);
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: quiz } = await supabase.from("quizzes").select("*, creator:profiles!quizzes_created_by_fkey(full_name)").eq("id", id).maybeSingle();
  if (!quiz) notFound();
  const [{ data: qq }, ds] = await Promise.all([
    supabase.from("quiz_questions").select("id, question_id, question_order, question_version, snapshot").eq("quiz_id", id).order("question_order"),
    loadPerformanceDataset(supabase),
  ]);
  const assignments = ds.allAssignments.filter((a) => a.quizId === id);
  const names = new Map(ds.collaborators.map((c) => [c.id, c.fullName]));
  const attempts = ds.attempts.filter((t) => assignments.some((a) => a.id === t.assignmentId));
  const attemptBy = new Map(attempts.map((t) => [t.assignmentId, t]));
  const answers = ds.answers.filter((a) => attempts.some((t) => t.id === a.attemptId));
  const errorBy = new Map(questionErrorRates(answers).map((r) => [r.questionId, r]));
  const valid = assignments.filter((a) => a.status !== "cancelled");
  const scores = attempts.map((t) => t.score);
  const canCancelQuiz = quiz.status === "active" && (profile.role === "supervisor" || quiz.created_by === profile.id);

  return (
    <div className="grid gap-6">
      <Link href="/avaliacoes" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-mz-chumbo"><ArrowLeft className="size-4" /> Avaliações</Link>
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-mz-chumbo sm:text-2xl">{quiz.title}</h1>
            {quiz.status === "cancelled" ? <ToneBadge tone="neutral">Cancelada</ToneBadge> : <ToneBadge tone="success">Ativa</ToneBadge>}
          </div>
          {quiz.description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{quiz.description}</p>}
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><FileText className="size-3.5" /><dt className="sr-only">Modo</dt><dd>{QUIZ_MODE_LABELS[quiz.quiz_mode]} · {quiz.question_count} questões</dd></div>
            <div className="flex items-center gap-1"><Users className="size-3.5" /><dt>Enviada por</dt><dd>{quiz.creator?.full_name}</dd></div>
            <div className="flex items-center gap-1"><CalendarDays className="size-3.5" /><dt>Envio:</dt><dd>{formatDateTime(quiz.available_from)}</dd></div>
            <div className="flex items-center gap-1"><Clock className="size-3.5" /><dt>Prazo:</dt><dd>{quiz.deadline ? formatDateTime(quiz.deadline) : "Sem prazo"}</dd></div>
            <div className="flex items-center gap-1"><RotateCcw className="size-3.5" /><dt>Tentativas:</dt><dd>{quiz.max_attempts}</dd></div>
            <div><dt className="inline">Gabarito após conclusão:</dt> <dd className="inline">{quiz.show_feedback ? "Sim" : "Não"}</dd></div>
            <div><dt className="inline">Meta:</dt> <dd className="inline">{formatScore(Number(quiz.passing_score))} pontos</dd></div>
          </dl>
        </div>
        {canCancelQuiz && <CancelQuizButton quizId={quiz.id} />}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Users} label="Colaboradores" value={valid.length} accent="neutral" />
        <KpiCard icon={CheckCircle2} label="Concluídas" value={valid.filter((a) => a.status === "completed").length} accent="green" />
        <KpiCard icon={Clock} label="Pendentes" value={valid.filter((a) => isOpenAssignment(a)).length} accent="yellow" />
        <KpiCard icon={Gauge} label="Média" value={formatScore(average(scores))} hint={`Aprovação: ${formatPercent(percentage(scores.filter((s) => s >= Number(quiz.passing_score)).length, scores.length))}`} accent="red" />
      </div>

      <Section title="Colaboradores" contentClassName="p-0">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Situação por colaborador</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Colaborador</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Conclusão</th>
                <th className="px-3 py-3 text-right font-semibold">Nota</th>
                <th className="px-3 py-3 text-right font-semibold">Acertos</th>
                <th className="px-3 py-3 text-right font-semibold">Tempo</th>
                <th className="px-3 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const t = attemptBy.get(a.id);
                const name = names.get(a.collaboratorId) ?? "Colaborador";
                return (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-5 py-3"><Link href={`/colaboradores/${a.collaboratorId}`} className="font-medium hover:text-mz-red-strong hover:underline">{name}</Link></td>
                    <td className="px-3 py-3"><AssignmentStatusBadge status={a.status} dueAt={a.dueAt} /></td>
                    <td className="px-3 py-3 whitespace-nowrap">{t ? formatDateTime(t.completedAt) : "—"}</td>
                    <td className="px-3 py-3 text-right"><ScoreText score={t?.score} passing={Number(quiz.passing_score)} /></td>
                    <td className="tabular px-3 py-3 text-right">{t ? `${t.correct}/${t.total}` : "—"}</td>
                    <td className="px-3 py-3 text-right">{t ? formatDuration(t.durationSeconds) : "—"}</td>
                    <td className="px-3 py-3 text-right">
                      {t ? <Link href={`/resultado/${t.id}`} className="text-xs font-medium text-mz-red-strong hover:underline">Ver respostas</Link>
                        : (a.status === "pending" || a.status === "in_progress") && <CancelAssignmentButton assignmentId={a.id} name={name} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Questões aplicadas" description="Conteúdo congelado no momento do envio (edições posteriores no banco não alteram esta avaliação)." contentClassName="p-0">
        <ol className="divide-y">
          {(qq ?? []).map((row) => {
            const s = row.snapshot as unknown as Snapshot;
            const err = errorBy.get(row.question_id);
            return (
              <li key={row.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <p className="text-sm text-mz-chumbo"><span className="mr-1 font-semibold">{row.question_order}.</span>{s.statement}</p>
                  <p className="text-xs text-muted-foreground">{s.category_name} · {s.topic} · {DIFFICULTY_LABELS[s.difficulty]} · versão {row.question_version}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{err ? <span className="font-medium text-mz-red-strong">{formatPercent(err.errorRate)} de erro ({err.wrong}/{err.total})</span> : answers.length ? "Sem erros" : ""}</p>
              </li>
            );
          })}
        </ol>
      </Section>
      <p className="text-xs text-muted-foreground">Criada em {formatDate(quiz.created_at)}.</p>
    </div>
  );
}
