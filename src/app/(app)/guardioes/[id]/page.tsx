import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Gauge, Mail, Users } from "lucide-react";
import { KpiCard } from "@/components/common/kpi-card";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { ScoreText, TrendIndicator, UserStatusBadge } from "@/components/common/status-badges";
import { EditUserDialog } from "@/components/forms/edit-user-dialog";
import { AddToTeam, UnlinkButton } from "@/components/forms/team-manager";
import { AttentionList } from "@/components/dashboard/attention-list";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset } from "@/lib/data/performance";
import { attentionAlerts, isOpenAssignment } from "@/lib/domain/analytics";
import { average } from "@/lib/domain/scoring";
import { formatDate, formatScore } from "@/lib/domain/format";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Guardião" };

export default async function GuardianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(["supervisor"]);
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: g } = await supabase.from("profiles").select("*").eq("id", id).eq("role", "guardian").maybeSingle();
  if (!g) notFound();
  const ds = await loadPerformanceDataset(supabase);
  const team = ds.collaborators.filter((c) => c.guardianId === id);
  const teamIds = new Set(team.map((t) => t.id));
  const pending = ds.allAssignments.filter((a) => teamIds.has(a.collaboratorId) && isOpenAssignment(a)).length;
  const teamAvg = average(ds.attempts.filter((a) => teamIds.has(a.collaboratorId)).map((a) => a.score));
  const candidates = ds.collaborators
    .filter((c) => c.guardianId !== id && c.status !== "inactive")
    .map((c) => ({ id: c.id, fullName: c.fullName, currentGuardian: c.guardianName }));
  const alerts = attentionAlerts({
    ...ds,
    collaborators: team,
    passingScore: ds.settings.passingScore,
    attentionScore: ds.settings.attentionScore,
  });

  return (
    <div className="grid gap-6">
      <Link href="/guardioes" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-mz-chumbo"><ArrowLeft className="size-4" /> Guardiões</Link>
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-mz-chumbo sm:text-2xl">{g.full_name}</h1>
            <UserStatusBadge status={g.status} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="size-4" />{g.email} · Cadastro em {formatDate(g.created_at)}</p>
        </div>
        <EditUserDialog user={{ id: g.id, fullName: g.full_name, email: g.email, jobTitle: g.job_title, startedAt: g.started_at, status: g.status }} />
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard icon={Users} label="Colaboradores acompanhados" value={team.filter((t) => t.status !== "inactive").length} accent="neutral" />
        <KpiCard icon={Gauge} label="Média da equipe" value={formatScore(teamAvg)} accent="red" />
        <KpiCard icon={Clock} label="Avaliações pendentes" value={pending} accent="yellow" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section title="Equipe" description="Vincule ou desvincule colaboradores deste guardião." className="xl:col-span-2" actions={g.status !== "inactive" ? <AddToTeam guardianId={id} candidates={candidates} /> : undefined}>
          {team.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum colaborador vinculado" />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">Colaboradores vinculados</caption>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-semibold">Colaborador</th>
                    <th className="py-2 text-right font-semibold">Média</th>
                    <th className="py-2 text-right font-semibold">Avaliações</th>
                    <th className="py-2 pl-4 font-semibold">Tendência</th>
                    <th className="py-2"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((c) => {
                    const s = ds.statsByCollaborator.get(c.id);
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2"><Link href={`/colaboradores/${c.id}`} className="font-medium hover:text-mz-red-strong hover:underline">{c.fullName}</Link>{c.status === "inactive" && <span className="ml-2"><UserStatusBadge status="inactive" /></span>}</td>
                        <td className="py-2 text-right"><ScoreText score={s?.average} passing={ds.settings.passingScore} /></td>
                        <td className="tabular py-2 text-right">{s?.count ?? 0}</td>
                        <td className="py-2 pl-4"><TrendIndicator trend={s?.trend ?? "insufficient"} delta={s?.delta} /></td>
                        <td className="py-2 text-right"><UnlinkButton collaboratorId={c.id} name={c.fullName} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <Section title="Atenção necessária"><AttentionList alerts={alerts} limit={6} /></Section>
      </div>
    </div>
  );
}
