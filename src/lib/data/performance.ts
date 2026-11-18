import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";
import type {
  AnswerRecord,
  AssignmentRecord,
  AttemptRecord,
  CategoryRecord,
  CollaboratorRecord,
  CollaboratorStats,
} from "@/lib/domain/analytics";
import { collaboratorStats, groupBy } from "@/lib/domain/analytics";
import { DEFAULT_ATTENTION_SCORE, DEFAULT_PASSING_SCORE } from "@/lib/domain/scoring";

const PAGE = 1000;

/** Busca todas as páginas de uma consulta (o PostgREST limita a 1000 linhas). */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type Settings = {
  passingScore: number;
  attentionScore: number;
  minAnswersForDiagnosis: number;
  defaultMaxAttempts: number;
  defaultDueDays: number;
};

export async function loadSettings(supabase: ServerSupabase): Promise<Settings> {
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  return {
    passingScore: Number(data?.passing_score ?? DEFAULT_PASSING_SCORE),
    attentionScore: Number(data?.attention_score ?? DEFAULT_ATTENTION_SCORE),
    minAnswersForDiagnosis: data?.min_answers_for_diagnosis ?? 2,
    defaultMaxAttempts: data?.default_max_attempts ?? 1,
    defaultDueDays: data?.default_due_days ?? 7,
  };
}

export async function loadCategories(supabase: ServerSupabase): Promise<CategoryRecord[]> {
  const { data, error } = await supabase.from("categories").select("id, name, sort_order").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, sortOrder: c.sort_order }));
}

/** Colaboradores visíveis ao usuário (RLS restringe guardiões à própria equipe). */
export async function loadCollaborators(supabase: ServerSupabase, ids?: string[]): Promise<CollaboratorRecord[]> {
  const profiles = await fetchAll((from, to) => {
    let q = supabase
      .from("profiles")
      .select("id, full_name, email, status, job_title, started_at, created_at, last_access_at")
      .eq("role", "collaborator")
      .order("full_name")
      .range(from, to);
    if (ids) q = q.in("id", ids);
    return q;
  });
  const links = await fetchAll((from, to) =>
    supabase
      .from("collaborator_assignments")
      .select("collaborator_id, guardian_id, guardian:profiles!collaborator_assignments_guardian_id_fkey(full_name)")
      .is("unassigned_at", null)
      .range(from, to),
  );
  const linkBy = new Map(links.map((l) => [l.collaborator_id, l]));
  return profiles.map((p) => {
    const link = linkBy.get(p.id);
    return {
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      status: p.status,
      jobTitle: p.job_title,
      startedAt: p.started_at,
      createdAt: p.created_at,
      lastAccessAt: p.last_access_at,
      guardianId: link?.guardian_id ?? null,
      guardianName: link?.guardian?.full_name ?? null,
    };
  });
}

export type DatasetFilter = {
  collaboratorIds?: string[];
  /** Período aplicado à conclusão das tentativas e ao envio das atribuições. */
  from?: string | null;
  to?: string | null;
};

export type PerformanceDataset = {
  settings: Settings;
  categories: CategoryRecord[];
  collaborators: CollaboratorRecord[];
  /** Todas as atribuições (sem filtro de período) — usadas para pendências. */
  allAssignments: AssignmentRecord[];
  /** Atribuições enviadas no período. */
  assignments: AssignmentRecord[];
  /** Tentativas oficiais concluídas no período. */
  attempts: AttemptRecord[];
  answers: AnswerRecord[];
  statsByCollaborator: Map<string, CollaboratorStats>;
};

export async function loadAssignments(supabase: ServerSupabase, collaboratorIds?: string[]): Promise<AssignmentRecord[]> {
  const rows = await fetchAll((from, to) => {
    let q = supabase
      .from("quiz_assignments")
      .select(
        "id, quiz_id, collaborator_id, assigned_by, assigned_at, due_at, status, completed_at, quiz:quizzes(title), sender:profiles!quiz_assignments_assigned_by_fkey(full_name)",
      )
      .order("assigned_at", { ascending: false })
      .range(from, to);
    if (collaboratorIds) q = q.in("collaborator_id", collaboratorIds);
    return q;
  });
  return rows.map((r) => ({
    id: r.id,
    quizId: r.quiz_id,
    quizTitle: r.quiz?.title ?? "Avaliação",
    collaboratorId: r.collaborator_id,
    assignedBy: r.assigned_by,
    assignedByName: r.sender?.full_name ?? null,
    assignedAt: r.assigned_at,
    dueAt: r.due_at,
    status: r.status,
    completedAt: r.completed_at,
  }));
}

export async function loadOfficialAttempts(
  supabase: ServerSupabase,
  titleByAssignment: Map<string, string>,
  filter: DatasetFilter,
): Promise<AttemptRecord[]> {
  const rows = await fetchAll((from, to) => {
    let q = supabase
      .from("official_attempts")
      .select(
        "id, assignment_id, collaborator_id, attempt_number, started_at, completed_at, score, correct_answers, incorrect_answers, unanswered, total_questions, duration_seconds",
      )
      .order("completed_at", { ascending: true })
      .range(from, to);
    if (filter.collaboratorIds) q = q.in("collaborator_id", filter.collaboratorIds);
    if (filter.from) q = q.gte("completed_at", filter.from);
    if (filter.to) q = q.lt("completed_at", filter.to);
    return q;
  });
  return rows
    .filter((r) => r.id && r.completed_at && r.score !== null)
    .map((r) => ({
      id: r.id!,
      assignmentId: r.assignment_id!,
      collaboratorId: r.collaborator_id!,
      quizTitle: titleByAssignment.get(r.assignment_id!) ?? "Avaliação",
      attemptNumber: r.attempt_number ?? 1,
      startedAt: r.started_at!,
      completedAt: r.completed_at!,
      score: Number(r.score),
      correct: r.correct_answers ?? 0,
      incorrect: r.incorrect_answers ?? 0,
      unanswered: r.unanswered ?? 0,
      total: r.total_questions ?? 0,
      durationSeconds: r.duration_seconds,
    }));
}

export async function loadAnswers(supabase: ServerSupabase, attempts: AttemptRecord[]): Promise<AnswerRecord[]> {
  const collabByAttempt = new Map(attempts.map((a) => [a.id, a.collaboratorId]));
  const out: AnswerRecord[] = [];
  for (const ids of chunk(attempts.map((a) => a.id), 80)) {
    const rows = await fetchAll((from, to) =>
      supabase
        .from("attempt_answers")
        .select("attempt_id, question_id, category_id, topic, is_correct")
        .in("attempt_id", ids)
        .order("id")
        .range(from, to),
    );
    for (const r of rows) {
      out.push({
        attemptId: r.attempt_id,
        collaboratorId: collabByAttempt.get(r.attempt_id)!,
        questionId: r.question_id,
        categoryId: r.category_id,
        topic: r.topic,
        isCorrect: r.is_correct === true,
      });
    }
  }
  return out;
}

/** Conjunto completo de dados de desempenho visível ao usuário atual. */
export async function loadPerformanceDataset(
  supabase: ServerSupabase,
  filter: DatasetFilter = {},
): Promise<PerformanceDataset> {
  // Aplica prazos vencidos antes de calcular indicadores.
  await supabase.rpc("expire_overdue");

  const [settings, categories, collaborators, allAssignments] = await Promise.all([
    loadSettings(supabase),
    loadCategories(supabase),
    loadCollaborators(supabase, filter.collaboratorIds),
    loadAssignments(supabase, filter.collaboratorIds),
  ]);
  const titleByAssignment = new Map(allAssignments.map((a) => [a.id, a.quizTitle]));
  const attempts = await loadOfficialAttempts(supabase, titleByAssignment, filter);
  const answers = await loadAnswers(supabase, attempts);

  const inRange = (iso: string) =>
    (!filter.from || new Date(iso) >= new Date(filter.from)) &&
    (!filter.to || new Date(iso) < new Date(filter.to));
  const assignments = allAssignments.filter((a) => inRange(a.assignedAt));

  const attemptsBy = groupBy(attempts, (a) => a.collaboratorId);
  const statsByCollaborator = new Map(
    collaborators.map((c) => [c.id, collaboratorStats(attemptsBy.get(c.id) ?? [], settings.passingScore)]),
  );

  return { settings, categories, collaborators, allAssignments, assignments, attempts, answers, statsByCollaborator };
}

export async function loadReinforcement(supabase: ServerSupabase, collaboratorId: string) {
  const { data, error } = await supabase.rpc("get_reinforcement_items", { p_collaborator: collaboratorId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    questionId: r.question_id,
    topic: r.topic,
    categoryId: r.category_id,
    statement: r.statement,
    studyTip: r.study_tip,
    wrong: r.wrong,
    total: r.total,
  }));
}
