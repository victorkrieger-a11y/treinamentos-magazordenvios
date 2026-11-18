/**
 * Cria o primeiro supervisor da plataforma de forma segura.
 *
 *   npm run create-supervisor -- --email nome@magazord.com.br --name "Nome Completo"
 *     → envia um convite por e-mail (o supervisor define a própria senha).
 *
 *   npm run create-supervisor -- --email ... --name ... --password-prompt
 *     → define a senha digitada no terminal (útil em ambiente local sem e-mail).
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (lidos de .env.local).
 * Nenhuma credencial fica no código-fonte.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

config({ path: ".env.local" });
config();

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    "password-prompt": { type: "boolean", default: false },
  },
});

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");

  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Informe --email válido.");
  if (!name || name.length < 3) throw new Error('Informe --name "Nome Completo".');

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string;
  let status: "active" | "invited";
  if (values["password-prompt"]) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const password = await rl.question("Senha (mín. 8 caracteres, letras e números): ");
    rl.close();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error("Senha fraca.");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
    if (error || !data.user) throw new Error(error?.message ?? "Falha ao criar usuário.");
    userId = data.user.id;
    status = "active";
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
      redirectTo: `${site}/auth/callback?next=/definir-senha`,
    });
    if (error || !data.user) throw new Error(error?.message ?? "Falha ao enviar convite.");
    userId = data.user.id;
    status = "invited";
  }

  const { error } = await admin.rpc("provision_profile", {
    p: { id: userId, full_name: name, email, role: "supervisor", status },
  });
  if (error) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`Falha ao criar perfil: ${error.message}`);
  }
  console.log(status === "invited" ? `Convite enviado para ${email}.` : `Supervisor ${email} criado. Acesse ${site}/login.`);
}

main().catch((e) => {
  console.error(`Erro: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
