import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";
import type { AssignmentStatus } from "@/lib/domain/status";
import { effectiveAssignmentStatus } from "@/lib/domain/status";

export type MyAssignment = {
  id: string;
  quizId: string;
  title: string;
  description: string | null;
  questionCount: number;
  maxAttempts: number;
  showFeedback: boolean;
  allowIncomplete: boolean;
  passingScore: number;
  senderName: string | null;
  assignedAt: string;
  dueAt: string | null;
  status: AssignmentStatus;
  completedAttempts: number;
  openAttemptId: string | null;
  bestAttemptId: string | null;
  bestScore: number | null;
  lastCompletedAt: string | null;
  canStart: boolean;
};

export async function loadMyAssignments(supabase: ServerSupabase, userId: string): Promise<MyAssignment[]> {
  await supabase.rpc("expire_overdue");
  const [{ data: assignments, error }, { data: attempts }] = await Promise.all([
    supabase
      .from("quiz_assignments")
      .select("id, quiz_id, assigned_at, due_at, status, quiz:quizzes(title, description, question_count, max_attempts, show_feedback, allow_incomplete, passing_score, status), sender:profiles!quiz_assignments_assigned_by_fkey(full_name)")
      .eq("collaborator_id", userId)
      .order("assigned_at", { ascending: false }),
    supabase.from("quiz_attempts").select("id, assignment_id, status, score, completed_at").eq("collaborator_id", userId),
  ]);
  if (error) throw new Error(error.message);

  const now = new Date();
  return (assignments ?? []).map((a) => {
    const own = (attempts ?? []).filter((t) => t.assignment_id === a.id);
    const completed = own.filter((t) => t.status === "completed");
    const best = [...completed].sort((x, y) => Number(y.score) - Number(x.score) || (y.completed_at ?? "").localeCompare(x.completed_at ?? ""))[0];
    const open = own.find((t) => t.status === "in_progress");
    const status = effectiveAssignmentStatus(a.status, a.due_at, now);
    const maxAttempts = a.quiz?.max_attempts ?? 1;
    const notExpired = !a.due_at || new Date(a.due_at) > now;
    return {
      id: a.id,
      quizId: a.quiz_id,
      title: a.quiz?.title ?? "Avaliação",
      description: a.quiz?.description ?? null,
      questionCount: a.quiz?.question_count ?? 0,
      maxAttempts,
      showFeedback: a.quiz?.show_feedback ?? false,
      allowIncomplete: a.quiz?.allow_incomplete ?? true,
      passingScore: Number(a.quiz?.passing_score ?? 80),
      senderName: a.sender?.full_name ?? null,
      assignedAt: a.assigned_at,
      dueAt: a.due_at,
      status,
      completedAttempts: completed.length,
      openAttemptId: open?.id ?? null,
      bestAttemptId: best?.id ?? null,
      bestScore: best ? Number(best.score) : null,
      lastCompletedAt: completed.map((c) => c.completed_at).sort().at(-1) ?? null,
      canStart: status !== "cancelled" && status !== "expired" && notExpired && (!!open || completed.length < maxAttempts),
    };
  });
}

export function isPending(a: MyAssignment) {
  return a.status === "pending" || a.status === "in_progress";
}
