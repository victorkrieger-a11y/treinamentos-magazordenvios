import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { EmptyState } from "@/components/common/empty-state";
import { ScoreText, UserStatusBadge } from "@/components/common/status-badges";
import { UserFormDialog } from "@/components/forms/user-form-dialog";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset } from "@/lib/data/performance";
import { loadGuardians } from "@/lib/data/people";
import { average } from "@/lib/domain/scoring";
import { isOpenAssignment } from "@/lib/domain/analytics";
import { formatDate } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Guardiões" };

export default async function GuardiansPage() {
  await requireSession(["supervisor"]);
  const supabase = await createClient();
  const [guardians, ds] = await Promise.all([loadGuardians(supabase), loadPerformanceDataset(supabase)]);

  const rows = guardians.map((g) => {
    const team = ds.collaborators.filter((c) => c.guardianId === g.id && c.status !== "inactive");
    const teamIds = new Set(team.map((t) => t.id));
    const scores = ds.attempts.filter((a) => teamIds.has(a.collaboratorId)).map((a) => a.score);
    const pending = ds.allAssignments.filter((a) => teamIds.has(a.collaboratorId) && isOpenAssignment(a)).length;
    return { ...g, teamSize: team.length, average: average(scores), pending };
  });

  return (
    <>
      <PageHeader title="Guardiões" description="Responsáveis pelo acompanhamento operacional das equipes." actions={<UserFormDialog role="guardian" triggerLabel="Novo guardião" />} />
      <Section contentClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nenhum guardião cadastrado" description="Cadastre guardiões para distribuir o acompanhamento dos colaboradores." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Guardiões</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Guardião</th>
                  <th className="px-3 py-3 text-right font-semibold">Colaboradores</th>
                  <th className="px-3 py-3 text-right font-semibold">Média da equipe</th>
                  <th className="px-3 py-3 text-right font-semibold">Pendentes</th>
                  <th className="px-3 py-3 font-semibold">Último acesso</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link href={`/guardioes/${g.id}`} className="font-medium text-mz-chumbo hover:text-mz-red-strong hover:underline">{g.fullName}</Link>
                      <p className="text-xs text-muted-foreground">{g.email}</p>
                    </td>
                    <td className="tabular px-3 py-3 text-right">{g.teamSize}</td>
                    <td className="px-3 py-3 text-right"><ScoreText score={g.average} passing={ds.settings.passingScore} /></td>
                    <td className="tabular px-3 py-3 text-right">{g.pending}</td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDate(g.lastAccessAt, "Nunca acessou")}</td>
                    <td className="px-3 py-3"><UserStatusBadge status={g.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
