"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation/common";
import { uuid } from "@/lib/validation/common";
import { quizSchema, toQuizPayload } from "@/lib/validation/quizzes";
import { dbErrorMessage, failure } from "@/server/errors";

export async function createQuiz(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await assertRole(["supervisor", "guardian"]);
    const data = quizSchema.parse(input);
    const supabase = await createClient();
    // Permissões (equipe do guardião, colaboradores ativos) são revalidadas no banco.
    const { data: id, error } = await supabase.rpc("create_quiz", { p: toQuizPayload(data) });
    if (error || !id) return { ok: false, error: dbErrorMessage(error) };
    revalidatePath("/avaliacoes");
    revalidatePath("/painel");
    return { ok: true, data: { id }, message: "Avaliação enviada com sucesso." };
  } catch (e) {
    return failure(e);
  }
}

export async function cancelAssignment(assignmentId: string): Promise<ActionResult> {
  try {
    await assertRole(["supervisor", "guardian"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_assignment", { p_assignment_id: uuid.parse(assignmentId) });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidatePath("/avaliacoes", "layout");
    return { ok: true, message: "Atribuição cancelada." };
  } catch (e) {
    return failure(e);
  }
}

export async function cancelQuiz(quizId: string): Promise<ActionResult> {
  try {
    await assertRole(["supervisor", "guardian"]);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_quiz", { p_quiz_id: uuid.parse(quizId) });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidatePath("/avaliacoes", "layout");
    return { ok: true, message: `Avaliação cancelada (${data ?? 0} atribuição(ões) em aberto canceladas).` };
  } catch (e) {
    return failure(e);
  }
}
