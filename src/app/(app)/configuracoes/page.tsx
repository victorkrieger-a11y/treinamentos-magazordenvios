import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { SettingsForm } from "@/components/forms/settings-form";
import { UserFormDialog } from "@/components/forms/user-form-dialog";
import { UserStatusBadge } from "@/components/common/status-badges";
import { EditUserDialog } from "@/components/forms/edit-user-dialog";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/data/performance";
import { CLASSIFICATIONS } from "@/lib/domain/scoring";
import { formatDate } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { userId } = await requireSession(["supervisor"]);
  const supabase = await createClient();
  const [settings, { data: supervisors }] = await Promise.all([
    loadSettings(supabase),
    supabase.from("profiles").select("id, full_name, email, status, job_title, started_at, last_access_at").eq("role", "supervisor").order("full_name"),
  ]);
  return (
    <div className="grid gap-6">
      <PageHeader title="Configurações" description="Parâmetros globais da plataforma. Alterações ficam registradas nos logs." />
      <Section title="Avaliações e desempenho">
        <SettingsForm initial={settings} />
      </Section>
      <Section title="Faixas de classificação" description="Definidas pela política de treinamento.">
        <ul className="grid gap-2 sm:grid-cols-4">
          {Object.values(CLASSIFICATIONS).map((c, i, arr) => (
            <li key={c.label} className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-semibold text-mz-chumbo">{c.label}</p>
              <p className="tabular text-xs text-muted-foreground">{c.min} a {i === 0 ? 100 : `${arr[i - 1].min - 0.01}`.replace(".", ",")}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Supervisores" description="Usuários com acesso administrativo completo." actions={<UserFormDialog role="supervisor" triggerLabel="Novo supervisor" />} contentClassName="p-0">
        <ul className="divide-y">
          {(supervisors ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-mz-chumbo">{s.full_name}{s.id === userId && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}</p>
                <p className="text-xs text-muted-foreground">{s.email} · último acesso {formatDate(s.last_access_at, "—")}</p>
              </div>
              <div className="flex items-center gap-2">
                <UserStatusBadge status={s.status} />
                {s.id !== userId && <EditUserDialog user={{ id: s.id, fullName: s.full_name, email: s.email, jobTitle: s.job_title, startedAt: s.started_at, status: s.status }} />}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
