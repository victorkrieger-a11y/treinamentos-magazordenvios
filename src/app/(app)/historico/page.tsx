import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { HistoryTable, type HistoryRow } from "@/components/tables/history-table";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset } from "@/lib/data/performance";

export const metadata: Metadata = { title: "Histórico" };

export default async function HistoryPage() {
  const { userId } = await requireSession(["collaborator"]);
  const supabase = await createClient();
  const ds = await loadPerformanceDataset(supabase, { collaboratorIds: [userId] });
  const byAssignment = new Map(ds.attempts.map((a) => [a.assignmentId, a]));
  const rows: HistoryRow[] = ds.allAssignments.map((a) => {
    const t = byAssignment.get(a.id);
    return { assignmentId: a.id, title: a.quizTitle, assignedAt: a.assignedAt, dueAt: a.dueAt, completedAt: t?.completedAt ?? null, score: t?.score ?? null, correct: t?.correct ?? null, incorrect: t?.incorrect ?? null, status: a.status, attemptId: t?.id ?? null, canOpenResult: true };
  });
  return (
    <>
      <PageHeader title="Histórico" description="Todas as avaliações recebidas. Considera-se a melhor tentativa de cada avaliação." />
      <Section><HistoryTable rows={rows} passingScore={ds.settings.passingScore} /></Section>
    </>
  );
}
