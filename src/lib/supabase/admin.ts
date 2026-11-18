import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv, serviceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente com service_role (ignora RLS). Uso restrito ao servidor e somente
 * depois de validar a permissão do solicitante — hoje apenas para
 * provisionar contas e bloquear/desbloquear usuários no Supabase Auth.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Cliente público sem sessão e com fluxo implícito, para disparar e-mails de
 * recuperação/acesso. Diferente do PKCE, o link funciona em qualquer
 * navegador/dispositivo (ex.: supervisor reenviando o acesso de outra pessoa).
 */
export function createEmailAuthClient() {
  const env = publicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, flowType: "implicit" },
  });
}
