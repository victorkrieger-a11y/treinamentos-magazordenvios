"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation/common";
import { uuid } from "@/lib/validation/common";
import { dbErrorMessage, failure } from "@/server/errors";

export async function startAttempt(assignmentId: string): Promise<ActionResult> {
  let attemptId: string | null = null;
  try {
    await assertRole(["collaborator"]);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_attempt", { p_assignment_id: uuid.parse(assignmentId) });
    if (error || !data) return { ok: false, error: dbErrorMessage(error) };
    attemptId = data;
  } catch (e) {
    return failure(e);
  }
  redirect(`/quiz/${attemptId}`);
}

/** Persiste a resposta no servidor (sem revelar se está correta). */
export async function saveAnswer(attemptId: string, answerId: string, optionId: string): Promise<ActionResult<{ savedAt: string }>> {
  try {
    await assertRole(["collaborator"]);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_answer", {
      p_attempt_id: uuid.parse(attemptId),
      p_answer_id: uuid.parse(answerId),
      p_option_id: uuid.parse(optionId),
    });
    if (error) return { ok: false, error: dbErrorMessage(error, "Não foi possível salvar sua resposta. Verifique a conexão.") };
    return { ok: true, data: { savedAt: data } };
  } catch (e) {
    return failure(e);
  }
}

/** Finaliza e corrige no servidor (transação + bloqueio; idempotente). */
export async function finalizeAttempt(attemptId: string): Promise<ActionResult> {
  let id: string;
  try {
    await assertRole(["collaborator"]);
    id = uuid.parse(attemptId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("finalize_attempt", { p_attempt_id: id });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidatePath("/minhas-avaliacoes");
    revalidatePath("/painel");
  } catch (e) {
    return failure(e);
  }
  redirect(`/resultado/${id}?concluida=1`);
}
