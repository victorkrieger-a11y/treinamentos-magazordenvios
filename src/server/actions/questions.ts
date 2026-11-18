"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation/common";
import { questionSchema, toQuestionPayload } from "@/lib/validation/questions";
import { uuid } from "@/lib/validation/common";
import { dbErrorMessage, failure } from "@/server/errors";

export async function saveQuestion(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await assertRole(["supervisor"]);
    const data = questionSchema.parse(input);
    const supabase = await createClient();
    const { data: id, error } = await supabase.rpc("save_question", { p: toQuestionPayload(data) });
    if (error || !id) return { ok: false, error: dbErrorMessage(error) };
    revalidatePath("/perguntas");
    return { ok: true, data: { id }, message: data.id ? "Questão atualizada (nova versão registrada)." : "Questão criada." };
  } catch (e) {
    return failure(e);
  }
}

export async function setQuestionActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await assertRole(["supervisor"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_question_active", { p_id: uuid.parse(id), p_active: active });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidatePath("/perguntas");
    return { ok: true, message: active ? "Questão ativada." : "Questão desativada." };
  } catch (e) {
    return failure(e);
  }
}
