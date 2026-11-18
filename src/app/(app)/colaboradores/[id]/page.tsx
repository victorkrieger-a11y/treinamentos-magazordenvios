import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, CalendarDays, ClipboardCheck, Gauge, Mail, Plus, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/common/kpi-card";
import { ClassificationBadge, UserStatusBadge } from "@/components/common/status-badges";
import { PerformanceDetail } from "@/components/dashboard/performance-detail";
import { EditUserDialog } from "@/components/forms/edit-user-dialog";
import { GuardianLinkSelect } from "@/components/forms/guardian-link-select";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset, loadReinforcement } from "@/lib/data/performance";
import { loadGuardians } from "@/lib/data/people";
import { formatDate, formatPercent, formatScore } from "@/lib/domain/format";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Perfil do colaborador" };

export default async function CollaboratorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireSession(["supervisor", "guardian"]);
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const supabase = await createClient();
  const ds = await loadPerformanceDataset(supabase, { collaboratorIds: [id] });
  const c = ds.collaborators[0];
  // RLS: guardiões só enxergam colaboradores da própria equipe.
  if (!c) notFound();
  const [reinforcement, guardians] = await Promise.all([loadReinforcement(supabase, id), profile.role === "supervisor" ? loadGuardians(supabase) : Promise.resolve([])]);
  const stats = ds.statsByCollaborator.get(id);
  const last = ds.attempts.at(-1);
  const isSupervisor = profile.role === "supervisor";

  return (
    <div className="grid gap-6">
      <Link href="/colaboradores" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-mz-chumbo">
        <ArrowLeft className="size-4" /> Colaboradores
      </Link>

      <section className="rounded-xl border bg-card p-5" aria-label="Resumo">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-mz-chumbo sm:text-2xl">{c.fullName}</h1>
              <UserStatusBadge status={c.status} />
              <ClassificationBadge score={stats?.average} />
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="flex items-center gap-1.5"><Mail className="size-4" aria-hidden /><dt className="sr-only">E-mail</dt><dd>{c.email}</dd></div>
              <div className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden /><dt>Cadastro:</dt><dd>{formatDate(c.createdAt)}</dd></div>
              {c.jobTitle && <div className="flex items-center gap-1.5"><Award className="size-4" aria-hidden /><dt className="sr-only">Cargo</dt><dd>{c.jobTitle}</dd></div>}
              {c.startedAt && <div className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden /><dt>Entrada na operação:</dt><dd>{formatDate(c.startedAt)}</dd></div>}
              <div className="flex items-center gap-1.5"><ShieldCheck className="size-4" aria-hidden /><dt>Guardião:</dt>
                <dd>{isSupervisor ? <GuardianLinkSelect collaboratorId={c.id} guardianId={c.guardianId} guardians={guardians.filter((g) => g.status !== "inactive")} /> : (c.guardianName ?? "Sem vínculo")}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSupervisor && <EditUserDialog user={{ id: c.id, fullName: c.fullName, email: c.email, jobTitle: c.jobTitle, startedAt: c.startedAt, status: c.status }} />}
            {c.status !== "inactive" && (
              <Button asChild size="sm"><Link href={`/avaliacoes/nova?colaborador=${c.id}`}><Plus /> Enviar avaliação</Link></Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Gauge} label="Média geral" value={formatScore(stats?.average)} accent="red" />
        <KpiCard icon={ClipboardCheck} label="Avaliações concluídas" value={stats?.count ?? 0} accent="neutral" />
        <KpiCard icon={Target} label="Aprovação" value={formatPercent(stats?.approvalRate)} hint={`Meta: ${formatScore(ds.settings.passingScore)}`} accent="green" />
        <KpiCard icon={Award} label="Última avaliação" value={formatScore(stats?.lastScore)} hint={last ? `${last.quizTitle} · ${formatDate(last.completedAt)}` : "Nenhuma concluída"} accent="blue" />
      </div>

      <PerformanceDetail ds={ds} collaboratorId={id} reinforcement={reinforcement} subject="colaborador" />
    </div>
  );
}
