/**
 * SOMENTE DESENVOLVIMENTO/TESTES LOCAIS.
 * Cria usuários de demonstração (1 supervisor, 2 guardiões, 4 colaboradores)
 * no Supabase LOCAL, com a senha informada em DEV_SEED_PASSWORD.
 * Recusa-se a executar contra qualquer URL que não seja localhost.
 *
 *   DEV_SEED_PASSWORD='SuaSenha123' npm run dev:seed-users
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

export const DEV_USERS = [
  { key: "supervisor", email: "supervisor@teste.local", name: "Sofia Supervisora", role: "supervisor" },
  { key: "guardiao1", email: "guardiao1@teste.local", name: "Gustavo Guardião", role: "guardian" },
  { key: "guardiao2", email: "guardiao2@teste.local", name: "Gabriela Guardiã", role: "guardian" },
  { key: "colab1", email: "colab1@teste.local", name: "Carlos Colaborador", role: "collaborator", guardian: "guardiao1" },
  { key: "colab2", email: "colab2@teste.local", name: "Camila Colaboradora", role: "collaborator", guardian: "guardiao1" },
  { key: "colab3", email: "colab3@teste.local", name: "Caio Colaborador", role: "collaborator", guardian: "guardiao2" },
  { key: "colab4", email: "colab4@teste.local", name: "Clara Colaboradora", role: "collaborator" },
] as const;

export async function seedDevUsers(password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
    throw new Error("dev-seed-users só pode ser executado contra o Supabase local.");
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids: Record<string, string> = {};
  for (const u of DEV_USERS) {
    const { data: existing } = await admin.from("profiles").select("id").eq("email", u.email).maybeSingle();
    if (existing) {
      ids[u.key] = existing.id;
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`${u.email}: ${error?.message}`);
    ids[u.key] = data.user.id;
    const guardianKey = "guardian" in u ? u.guardian : null;
    const { error: pErr } = await admin.rpc("provision_profile", {
      p: {
        id: data.user.id,
        actor_id: ids.supervisor ?? null,
        full_name: u.name,
        email: u.email,
        role: u.role,
        status: "active",
        guardian_id: guardianKey ? ids[guardianKey] : null,
      },
    });
    if (pErr) throw new Error(`${u.email}: ${pErr.message}`);
  }
  return ids;
}

if (process.argv[1]?.endsWith("dev-seed-users.ts")) {
  const password = process.env.DEV_SEED_PASSWORD;
  if (!password || password.length < 8) {
    console.error("Defina DEV_SEED_PASSWORD (mín. 8 caracteres).");
    process.exit(1);
  }
  seedDevUsers(password)
    .then((ids) => console.log("Usuários locais prontos:", Object.keys(ids).join(", ")))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
