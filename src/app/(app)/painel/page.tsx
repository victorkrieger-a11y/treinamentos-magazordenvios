import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { StaffDashboard } from "@/components/dashboard/staff-dashboard";
import { CollaboratorDashboard } from "@/components/dashboard/collaborator-dashboard";
import { FlashMessage } from "@/components/common/flash-message";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string; de?: string; ate?: string; erro?: string; senha?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  return (
    <>
      {params.erro === "permissao" && <FlashMessage tone="danger" message="Você não tem permissão para acessar a página solicitada." />}
      {params.senha === "ok" && <FlashMessage tone="success" message="Senha definida com sucesso. Bem-vindo(a)!" />}
      {session.profile.role === "collaborator" ? <CollaboratorDashboard session={session} /> : <StaffDashboard session={session} params={params} />}
    </>
  );
}
