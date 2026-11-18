import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, FileText, Info, RotateCcw, Target, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssignmentStatusBadge } from "@/components/common/status-badges";
import { StartButton } from "@/components/quiz/start-button";
import { timeLeft } from "@/components/quiz/assignment-card";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadMyAssignments } from "@/lib/data/my-assignments";
import { formatDateTime, formatScore } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Iniciar avaliação" };

export default async function StartQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireSession(["collaborator"]);
  const { id } = await params;
  const supabase = await createClient();
  const a = (await loadMyAssignments(supabase, userId)).find((x) => x.id === id);
  if (!a) notFound();

  const rules = [
    { icon: FileText, text: `${a.questionCount} questões de múltipla escolha, com quatro alternativas e apenas uma correta.` },
    { icon: RotateCcw, text: "Você pode navegar entre as questões e alterar respostas até finalizar. Seu progresso é salvo automaticamente." },
    { icon: Target, text: `Meta de aprovação: ${formatScore(a.passingScore)} pontos. Nota = acertos ÷ questões × 100.` },
    { icon: Info, text: a.showFeedback ? "O gabarito com explicações fica disponível após a conclusão." : "O gabarito desta avaliação não será exibido após a conclusão." },
    { icon: CheckCircle2, text: a.allowIncomplete ? "É possível finalizar com questões sem resposta (contam como erro)." : "Todas as questões precisam ser respondidas para finalizar." },
  ];

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Link href="/minhas-avaliacoes" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-mz-chumbo"><ArrowLeft className="size-4" /> Minhas avaliações</Link>
      <article className="overflow-hidden rounded-2xl border bg-card">
        <header className="border-b bg-gradient-to-b from-mz-red-soft/50 to-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-mz-red">Avaliação</p>
            <AssignmentStatusBadge status={a.status} dueAt={a.dueAt} />
          </div>
          <h1 className="mt-2 text-2xl font-bold text-mz-chumbo">{a.title}</h1>
          {a.description && <p className="mt-2 text-sm text-mz-gray-dark">{a.description}</p>}
          <dl className="mt-4 grid gap-2 text-sm text-mz-gray-dark sm:grid-cols-3">
            <div className="flex items-center gap-1.5"><UserRound className="size-4" /><dt className="sr-only">Enviada por</dt><dd>{a.senderName}</dd></div>
            <div className="flex items-center gap-1.5"><CalendarDays className="size-4" /><dt className="sr-only">Envio</dt><dd>{formatDateTime(a.assignedAt)}</dd></div>
            <div className="flex items-center gap-1.5 font-medium"><Clock className="size-4" /><dt className="sr-only">Prazo</dt><dd>{a.dueAt ? `Prazo: ${formatDateTime(a.dueAt)}` : "Sem prazo"}</dd></div>
          </dl>
        </header>
        <div className="p-6">
          <h2 className="text-sm font-semibold text-mz-chumbo">Antes de começar</h2>
          <ul className="mt-3 grid gap-3">
            {rules.map((r) => (
              <li key={r.text} className="flex items-start gap-3 text-sm text-mz-gray-dark"><r.icon className="mt-0.5 size-4 shrink-0 text-mz-red" aria-hidden />{r.text}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Tentativas utilizadas: {a.completedAttempts} de {a.maxAttempts}.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-6">
            {a.canStart ? (
              <>
                <StartButton assignmentId={a.id} label={a.openAttemptId ? "Continuar avaliação" : a.completedAttempts ? "Iniciar nova tentativa" : "Iniciar avaliação"} />
                {a.dueAt && <span className="text-sm font-medium text-mz-red-strong">{timeLeft(a.dueAt)}</span>}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {a.status === "expired" ? "O prazo desta avaliação foi encerrado." : a.status === "cancelled" ? "Esta avaliação foi cancelada." : "Você já utilizou todas as tentativas permitidas."}
              </p>
            )}
            {a.bestAttemptId && <Button asChild variant="outline"><Link href={`/resultado/${a.bestAttemptId}`}>Ver resultado</Link></Button>}
          </div>
        </div>
      </article>
    </div>
  );
}
