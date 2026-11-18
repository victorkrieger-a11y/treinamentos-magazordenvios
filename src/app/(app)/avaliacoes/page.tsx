import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { ScoreText } from "@/components/common/status-badges";
import { ToneBadge } from "@/components/common/tone-badge";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset } from "@/lib/data/performance";
import { groupBy, isOpenAssignment } from "@/lib/domain/analytics";
import { average } from "@/lib/domain/scoring";
import { formatDate, formatDateTime } from "@/lib/domain/format";
import { QUIZ_MODE_LABELS } from "@/lib/domain/status";

export const metadata: Metadata = { title: "Avaliações" };

export default async function QuizzesPage() {
  await requireSession(["supervisor", "guardian"]);
  const supabase = await createClient();
  const [{ data: quizzes }, ds] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, quiz_mode, question_count, available_from, deadline, status, created_at, creator:profiles!quizzes_created_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(300),
    loadPerformanceDataset(supabase),
  ]);
  const byQuiz = groupBy(ds.allAssignments, (a) => a.quizId);
  const attemptByAssignment = new Map(ds.attempts.map((a) => [a.assignmentId, a]));

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="Avaliações enviadas, acompanhamento de pendências e resultados."
        actions={<Button asChild><Link href="/avaliacoes/nova"><Plus /> Nova avaliação</Link></Button>}
      />
      <Section contentClassName="p-0">
        {!quizzes?.length ? (
          <EmptyState icon={ClipboardList} title="Nenhuma avaliação enviada" description="Envie a avaliação padrão com as 30 questões oficiais para começar." action={<Button asChild size="sm"><Link href="/avaliacoes/nova">Nova avaliação</Link></Button>} />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Avaliações</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Avaliação</th>
                  <th className="px-3 py-3 font-semibold">Envio</th>
                  <th className="px-3 py-3 font-semibold">Prazo</th>
                  <th className="px-3 py-3 text-right font-semibold">Colaboradores</th>
                  <th className="px-3 py-3 text-right font-semibold">Concluídas</th>
                  <th className="px-3 py-3 text-right font-semibold">Pendentes</th>
                  <th className="px-3 py-3 text-right font-semibold">Média</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((q) => {
                  const list = (byQuiz.get(q.id) ?? []).filter((a) => a.status !== "cancelled");
                  const done = list.filter((a) => a.status === "completed");
                  const avg = average(done.map((a) => attemptByAssignment.get(a.id)?.score).filter((s): s is number => s !== undefined));
                  return (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-5 py-3">
                        <Link href={`/avaliacoes/${q.id}`} className="font-medium text-mz-chumbo hover:text-mz-red-strong hover:underline">{q.title}</Link>
                        <p className="text-xs text-muted-foreground">{QUIZ_MODE_LABELS[q.quiz_mode]} · {q.question_count} questões · por {q.creator?.full_name ?? "—"}</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatDate(q.available_from)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{q.deadline ? formatDateTime(q.deadline) : <span className="text-muted-foreground">Sem prazo</span>}</td>
                      <td className="tabular px-3 py-3 text-right">{list.length}</td>
                      <td className="tabular px-3 py-3 text-right">{done.length}</td>
                      <td className="tabular px-3 py-3 text-right">{list.filter((a) => isOpenAssignment(a)).length}</td>
                      <td className="px-3 py-3 text-right"><ScoreText score={avg} passing={ds.settings.passingScore} /></td>
                      <td className="px-3 py-3">
                        {q.status === "cancelled" ? <ToneBadge tone="neutral">Cancelada</ToneBadge> : new Date(q.available_from) > new Date() ? <ToneBadge tone="info">Agendada</ToneBadge> : <ToneBadge tone="success">Ativa</ToneBadge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
