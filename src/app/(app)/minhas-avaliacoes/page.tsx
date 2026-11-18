import type { Metadata } from "next";
import { CheckCircle2, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { AssignmentCard } from "@/components/quiz/assignment-card";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isPending, loadMyAssignments } from "@/lib/data/my-assignments";

export const metadata: Metadata = { title: "Minhas avaliações" };

export default async function MyAssignmentsPage() {
  const { userId } = await requireSession(["collaborator"]);
  const supabase = await createClient();
  const all = await loadMyAssignments(supabase, userId);
  const pending = all.filter(isPending).sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  const others = all.filter((a) => !isPending(a));

  return (
    <div className="grid gap-6">
      <PageHeader title="Minhas avaliações" description="Avaliações recebidas, prazos e resultados." />
      <Section title={`Pendentes (${pending.length})`} className={pending.length ? "border-mz-red/25" : undefined}>
        {pending.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Você está em dia" description="Nenhuma avaliação aguardando conclusão." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">{pending.map((a) => <AssignmentCard key={a.id} a={a} highlight />)}</div>
        )}
      </Section>
      <Section title={`Concluídas, expiradas e canceladas (${others.length})`}>
        {others.length === 0 ? (
          <EmptyState icon={ListChecks} title="Nenhuma avaliação finalizada ainda" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">{others.map((a) => <AssignmentCard key={a.id} a={a} />)}</div>
        )}
      </Section>
    </div>
  );
}
