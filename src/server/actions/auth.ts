"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { createEmailAuthClient } from "@/lib/supabase/admin";
import { loginSchema, newPasswordSchema, recoverSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/validation/common";
import { failure } from "@/server/errors";

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/painel";
}

export async function signIn(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { ok: false, error: "E-mail ou senha inválidos." };
  }

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.status === "inactive") {
    await supabase.auth.signOut();
    return { ok: false, error: "Sua conta não está ativa. Procure o supervisor responsável." };
  }
  await supabase.rpc("touch_last_access");
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = recoverSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const { error } = await createEmailAuthClient().auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${site}/auth/callback?next=/definir-senha`,
  });
  if (error && error.status !== 429) console.error("[auth] reset", error.message);
  if (error?.status === 429) {
    return { ok: false, error: "Muitas solicitações em sequência. Aguarde alguns minutos e tente novamente." };
  }
  // Resposta neutra: não revela se o e-mail existe.
  return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link para definir uma nova senha." };
}

export async function setNewPassword(input: unknown): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "O link expirou. Solicite um novo acesso." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "A nova senha precisa ser diferente da atual." };
    if (error.code === "weak_password") return { ok: false, error: "Senha muito fraca. Use letras, números e pelo menos 8 caracteres." };
    return { ok: false, error: "Não foi possível definir a senha. Solicite um novo link." };
  }
  await supabase.rpc("touch_last_access");
  redirect("/painel?senha=ok");
}
