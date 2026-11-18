"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation/common";
import { settingsSchema } from "@/lib/validation/settings";
import { dbErrorMessage, failure } from "@/server/errors";

export async function updateSettings(input: unknown): Promise<ActionResult> {
  try {
    await assertRole(["supervisor"]);
    const d = settingsSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_settings", {
      p: {
        passing_score: d.passingScore,
        attention_score: d.attentionScore,
        min_answers_for_diagnosis: d.minAnswersForDiagnosis,
        default_max_attempts: d.defaultMaxAttempts,
        default_due_days: d.defaultDueDays,
      },
    });
    if (error) return { ok: false, error: dbErrorMessage(error) };
    revalidatePath("/", "layout");
    return { ok: true, message: "Configurações salvas." };
  } catch (e) {
    return failure(e);
  }
}
