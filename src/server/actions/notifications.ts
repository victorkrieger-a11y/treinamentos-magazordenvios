"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation/common";
import { uuid } from "@/lib/validation/common";
import { failure } from "@/server/errors";
import { z } from "zod";

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  try {
    const parsed = ids ? z.array(uuid).max(200).parse(ids) : null;
    const supabase = await createClient();
    const { error } = await supabase.rpc("mark_notifications_read", { p_ids: parsed ?? undefined });
    if (error) return { ok: false, error: "Não foi possível atualizar as notificações." };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
