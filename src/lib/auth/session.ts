import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/auth/roles";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionContext = {
  userId: string;
  profile: Profile;
};

/** Usuário autenticado + perfil ativo, ou null. Memorizado por requisição. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || profile.status === "inactive") return null;

  return { userId: user.id, profile };
});

/** Exige sessão (e opcionalmente um dos perfis). Redireciona caso contrário. */
export async function requireSession(roles?: UserRole[]): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login?erro=sessao");
  if (roles && !roles.includes(session.profile.role)) redirect("/painel?erro=permissao");
  return session;
}

export class AuthorizationError extends Error {
  constructor(message = "Você não tem permissão para executar esta ação.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Versão para Server Actions / Route Handlers: lança erro em vez de redirecionar. */
export async function assertRole(roles: UserRole[]): Promise<SessionContext> {
  const session = await getSession();
  if (!session || !roles.includes(session.profile.role)) throw new AuthorizationError();
  return session;
}
