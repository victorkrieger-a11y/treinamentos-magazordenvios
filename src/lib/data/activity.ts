import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";
import type { ActivityLog } from "@/lib/domain/activity";

export async function loadActivity(
  supabase: ServerSupabase,
  opts: { limit?: number; actions?: string[]; subjectId?: string; before?: number } = {},
): Promise<ActivityLog[]> {
  let q = supabase
    .from("audit_logs")
    .select("id, action, created_at, metadata, actor:profiles!audit_logs_user_id_fkey(full_name), subject:profiles!audit_logs_subject_user_id_fkey(full_name)")
    .order("id", { ascending: false })
    .limit(opts.limit ?? 15);
  if (opts.actions) q = q.in("action", opts.actions);
  if (opts.subjectId) q = q.eq("subject_user_id", opts.subjectId);
  if (opts.before) q = q.lt("id", opts.before);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    createdAt: r.created_at,
    actorName: r.actor?.full_name ?? null,
    subjectName: r.subject?.full_name ?? null,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
  }));
}
