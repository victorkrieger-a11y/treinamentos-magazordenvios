"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/session";
import { createAdminClient, createEmailAuthClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { ActionResult } from "@/lib/validation/common";
import { assignGuardianSchema, createUserSchema, updateUserSchema } from "@/lib/validation/users";
import { dbErrorMessage, failure } from "@/server/errors";

const BAN_FOREVER = "876000h";

/**
 * Provisiona uma conta: convite por e-mail pelo Supabase Auth + perfil +
 * vínculo com guardião. Somente supervisores. Não existe cadastro público.
 */
export async function createUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await assertRole(["supervisor"]);
    const data = createUserSchema.parse(input);
    const admin = createAdminClient();
    const site = publicEnv().NEXT_PUBLIC_SITE_URL;

    const { data: existing } = await admin.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (existing) return { ok: false, error: "Já existe um usuário com este e-mail.", fieldErrors: { email: ["E-mail já cadastrado."] } };

    if (data.guardianId) {
      const { data: g } = await admin.from("profiles").select("role, status").eq("id", data.guardianId).maybeSingle();
      if (!g || g.role !== "guardian" || g.status === "inactive") return { ok: false, error: "Guardião inválido ou inativo." };
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName },
      redirectTo: `${site}/auth/callback?next=/definir-senha`,
    });
    if (inviteError || !invited.user) {
      console.error("[users] invite", inviteError?.message);
      return {
        ok: false,
        error: inviteError?.message?.includes("already been registered")
          ? "Este e-mail já possui acesso ao Supabase Auth."
          : "Não foi possível enviar o convite. Verifique a configuração de e-mail do Supabase.",
      };
    }

    const { error } = await admin.rpc("provision_profile", {
      p: {
        id: invited.user.id,
        actor_id: session.userId,
        full_name: data.fullName,
        email: data.email,
        role: data.role,
        guardian_id: data.guardianId ?? null,
        job_title: data.jobTitle,
        started_at: data.startedAt,
      },
    });
    if (error) {
      // Desfaz o convite para não deixar contas sem perfil.
      await admin.auth.admin.deleteUser(invited.user.id);
      return { ok: false, error: dbErrorMessage(error) };
    }

    revalidatePath("/colaboradores");
    revalidatePath("/guardioes");
    revalidatePath("/painel");
    return { ok: true, data: { id: invited.user.id }, message: `Convite enviado para ${data.email}.` };
  } catch (e) {
    return failure(e);
  }
}

export async function updateUser(input: unknown): Promise<ActionResult> {
  try {
    await assertRole(["supervisor"]);
    const data = updateUserSchema.parse(input);
    const supabase = await createClient();
    const { data: before } = await supabase.from("profiles").select("status").eq("id", data.id).maybeSingle();
    if (!before) return { ok: false, error: "Usuário não encontrado." };

    const { error } = await supabase.rpc("admin_update_profile", {
      p_id: data.id,
      p: { full_name: data.fullName, job_title: data.jobTitle, started_at: data.startedAt, status: data.status },
    });
    if (error) return { ok: false, error: dbErrorMessage(error) };

    // Bloqueia/desbloqueia o login no Supabase Auth.
    if (before.status !== data.status && (data.status === "inactive" || before.status === "inactive")) {
      const admin = createAdminClient();
      const { error: banError } = await admin.auth.admin.updateUserById(data.id, {
        ban_duration: data.status === "inactive" ? BAN_FOREVER : "none",
      });
      if (banError) console.error("[users] ban", banError.message);
    }

    revalidatePath("/colaboradores");
    revalidatePath(`/colaboradores/${data.id}`);
    revalidatePath("/guardioes");
    return { ok: true, message: "Dados atualizados." };
  } catch (e) {
    return failure(e);
  }
}

export async function assignGuardian(input: unknown): Promise<ActionResult> {
  try {
    await assertRole(["supervisor"]);
    const data = assignGuardianSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.rpc("assign_guardian", {
      p_collaborator: data.collaboratorId,
      p_guardian: data.guardianId as string,
    });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidatePath("/colaboradores");
    revalidatePath("/guardioes");
    return { ok: true, message: data.guardianId ? "Guardião vinculado." : "Colaborador desvinculado." };
  } catch (e) {
    return failure(e);
  }
}

/** Reenvia o acesso (link para definir senha) a um usuário convidado. */
export async function resendAccess(userId: string): Promise<ActionResult> {
  try {
    await assertRole(["supervisor"]);
    const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("email, status").eq("id", userId).maybeSingle();
    if (!profile) return { ok: false, error: "Usuário não encontrado." };
    if (profile.status === "inactive") return { ok: false, error: "Reative o usuário antes de reenviar o acesso." };
    const site = publicEnv().NEXT_PUBLIC_SITE_URL;
    const { error } = await createEmailAuthClient().auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${site}/auth/callback?next=/definir-senha`,
    });
    if (error) return { ok: false, error: "Não foi possível reenviar o acesso agora. Tente novamente em alguns minutos." };
    return { ok: true, message: `Link de acesso enviado para ${profile.email}.` };
  } catch (e) {
    return failure(e);
  }
}
