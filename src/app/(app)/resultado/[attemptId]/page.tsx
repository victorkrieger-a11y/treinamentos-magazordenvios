import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Lock, Percent, Target, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/common/kpi-card";
import { Section } from "@/components/common/section";
import { ClassificationBadge } from "@/components/common/status-badges";
import { FlashMessage } from "@/components/common/flash-message";
import { CategoryChart } from "@/components/charts/charts";
import { AnswerReview } from "@/components/quiz/answer-review";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadCategories } from "@/lib/data/performance";
import { categoryPerformance } from "@/lib/domain/analytics";
import { formatDateTime, formatDuration, formatPercent, formatScoreFixed } from "@/lib/domain/format";
import { percentage } from "@/lib/domain/scoring";
import type { ReviewItem } from "@/lib/domain/quiz";
import { uuid } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Resultado" };

export default async function ResultPage({ params, searchParams }: { params: Promise<{ attemptId: string }>; searchParams: Promise<{ concluida?: string }> }) {
  const session = await requireSession();
  const { attemptId } = await params;
  const { concluida } = await searchParams;
  if (!uuid.safeParse(attemptId).success) notFound();
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("quiz_attempts")
    .select("*, assignment:quiz_assignments(id, quiz:quizzes(title, passing_score, show_feedback, max_attempts)), collaborator:profiles!quiz_attempts_collaborator_id_fkey(full_name)")
    .eq("id", attemptId)
    .maybeSingle();
  if (!t || t.status !== "completed" || t.score === null) notFound();

  const isOwner = t.collaborator_id === session.userId;
  const quiz = t.assignment?.quiz;
  const passing = Number(quiz?.passing_score ?? 80);
  const score = Number(t.score);
  const approved = score >= passing;
  const canReview = !isOwner || !!quiz?.show_feedback;

  const [{ data: answers }, categories, review] = await Promise.all([
    supabase.from("attempt_answers").select("category_id, topic, is_correct, question_id").eq("attempt_id", attemptId),
    loadCategories(supabase),
    canReview ? supabase.rpc("get_attempt_review", { p_attempt_id: attemptId }) : Promise.resolve({ data: null }),
  ]);
  const perf = categoryPerformance(
    (answers ?? []).map((a) => ({ attemptId, collaboratorId: t.collaborator_id, questionId: a.question_id, categoryId: a.category_id, topic: a.topic, isCorrect: !!a.is_correct })),
    categories,
    1,
  ).filter((c) => c.total > 0);
  const weakest = perf.filter((c) => (c.rate ?? 100) < passing).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0));

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      {concluida && <FlashMessage tone="success" message="Avaliação finalizada e corrigida." />}
      <Link href={isOwner ? "/minhas-avaliacoes" : `/colaboradores/${t.collaborator_id}`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-mz-chumbo">
        <ArrowLeft className="size-4" /> {isOwner ? "Minhas avaliações" : t.collaborator?.full_name}
      </Link>

      <section className={cn("overflow-hidden rounded-2xl border bg-card", approved ? "border-mz-green-dark/25" : "border-mz-yellow/50")}>
        <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8">
          <div className={cn("mx-auto flex size-36 flex-col items-center justify-center rounded-full border-[10px]", approved ? "border-mz-green-dark/80" : score >= 70 ? "border-mz-yellow" : "border-mz-red")} role="img" aria-label={`Nota ${formatScoreFixed(score)} de 100`}>
            <span className="font-display tabular text-4xl font-bold text-mz-chumbo">{formatScoreFixed(score)}</span>
            <span className="text-xs text-muted-foreground">de 100</span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mz-red">{quiz?.title}</p>
            {isOwner ? (
              approved ? (
                <>
                  <h1 className="mt-2 text-2xl font-bold text-mz-chumbo">Parabéns! Você concluiu sua avaliação.</h1>
                  <p className="mt-2 text-sm text-mz-gray-dark">Seu resultado foi {formatScoreFixed(score)} pontos. Você atingiu a meta mínima de aprovação.</p>
                </>
              ) : (
                <>
                  <h1 className="mt-2 text-2xl font-bold text-mz-chumbo">Avaliação concluída</h1>
                  <p className="mt-2 text-sm text-mz-gray-dark">Você concluiu sua avaliação, mas ainda precisa reforçar alguns conhecimentos. Confira os assuntos que precisam de atenção.</p>
                </>
              )
            ) : (
              <>
                <h1 className="mt-2 text-2xl font-bold text-mz-chumbo">Resultado de {t.collaborator?.full_name}</h1>
                <p className="mt-2 text-sm text-mz-gray-dark">{approved ? "Atingiu" : "Não atingiu"} a meta de aprovação de {formatScoreFixed(passing)} pontos.</p>
              </>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <ClassificationBadge score={score} />
              <span>Concluída em {formatDateTime(t.completed_at)} · Tentativa {t.attempt_number} de {quiz?.max_attempts}</span>
              {t.finalized_reason === "deadline" && <span className="font-medium text-mz-red-strong">· finalizada automaticamente no prazo</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={CheckCircle2} label="Acertos" value={t.correct_answers} accent="green" />
        <KpiCard icon={XCircle} label="Erros" value={t.incorrect_answers} hint={t.unanswered ? `${t.unanswered} sem resposta` : undefined} accent="red" />
        <KpiCard icon={Percent} label="Aproveitamento" value={formatPercent(percentage(t.correct_answers ?? 0, t.total_questions))} accent="blue" />
        <KpiCard icon={Clock} label="Tempo utilizado" value={formatDuration(t.duration_seconds)} accent="neutral" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Section title="Desempenho por categoria" className="lg:col-span-3">
          <CategoryChart data={perf.map((c) => ({ name: c.name, rate: c.rate, total: c.total }))} passingScore={passing} />
        </Section>
        <Section title="Assuntos que precisam de atenção" className="lg:col-span-2">
          {weakest.length === 0 ? (
            <p className="flex items-start gap-2 text-sm text-mz-green-dark"><Target className="mt-0.5 size-4" /> Aproveitamento igual ou acima da meta em todas as categorias.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {weakest.map((c) => (
                <li key={c.categoryId} className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
                  <span>{c.name}</span>
                  <span className="tabular text-xs text-muted-foreground">{c.correct}/{c.total} · {formatPercent(c.rate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Revisão das respostas" id="revisao">
        {canReview && review.data ? (
          <AnswerReview items={review.data as unknown as ReviewItem[]} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4" /> O gabarito desta avaliação não foi liberado pelo responsável.</p>
        )}
      </Section>

      {isOwner && (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/meu-desempenho">Ver meu desempenho</Link></Button>
          <Button asChild><Link href="/painel">Voltar ao painel</Link></Button>
        </div>
      )}
    </div>
  );
}
