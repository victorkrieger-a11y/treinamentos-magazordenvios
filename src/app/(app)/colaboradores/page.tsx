import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { UserFormDialog } from "@/components/forms/user-form-dialog";
import { CollaboratorsTable } from "@/components/tables/collaborators-table";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceDataset } from "@/lib/data/performance";
import { loadGuardians } from "@/lib/data/people";

export const metadata: Metadata = { title: "Colaboradores" };

export default async function CollaboratorsPage() {
  const { profile } = await requireSession(["supervisor", "guardian"]);
  const isSupervisor = profile.role === "supervisor";
  const supabase = await createClient();
  const [ds, guardians] = await Promise.all([loadPerformanceDataset(supabase), loadGuardians(supabase)]);
  const activeGuardians = guardians.filter((g) => g.status !== "inactive");

  const rows = ds.collaborators.map((c) => {
    const s = ds.statsByCollaborator.get(c.id);
    return { id: c.id, name: c.fullName, email: c.email, guardianId: c.guardianId, guardianName: c.guardianName, average: s?.average ?? null, count: s?.count ?? 0, status: c.status, jobTitle: c.jobTitle };
  });

  return (
    <>
      <PageHeader
        title={isSupervisor ? "Colaboradores" : "Minha equipe"}
        description={isSupervisor ? "Cadastro, vínculos e acompanhamento de todos os colaboradores." : "Colaboradores vinculados a você."}
        actions={isSupervisor && <UserFormDialog role="collaborator" triggerLabel="Novo colaborador" guardians={activeGuardians} />}
      />
      <Section>
        <CollaboratorsTable rows={rows} guardians={guardians} passingScore={ds.settings.passingScore} attentionScore={ds.settings.attentionScore} showGuardianFilter={isSupervisor} />
      </Section>
    </>
  );
}
