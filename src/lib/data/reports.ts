import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";
import { loadPerformanceDataset } from "@/lib/data/performance";
import { resolvePeriod, type Period } from "@/lib/domain/periods";
import {
  categoryPerformance,
  collaboratorStats,
  groupBy,
  pickGranularity,
  questionErrorRates,
  scoreTimeline,
} from "@/lib/domain/analytics";
import { average, classify, CLASSIFICATIONS, percentage, type Classification } from "@/lib/domain/scoring";
import { ASSIGNMENT_STATUS, effectiveAssignmentStatus, type AssignmentStatus } from "@/lib/domain/status";
import { formatDateTime, formatDuration, formatScore } from "@/lib/domain/format";

export type ReportParams = {
  periodo?: string;
  de?: string;
  ate?: string;
  colaborador?: string;
  guardiao?: string;
  avaliacao?: string;
  categoria?: string;
  nota?: string;
  status?: string;
};

export type ReportRow = {
  assignmentId: string;
  attemptId: string | null;
  collaboratorId: string;
  collaborator: string;
  guardian: string | null;
  quiz: string;
  assignedAt: string;
  dueAt: string | null;
  status: AssignmentStatus;
  completedAt: string | null;
  score: number | null;
  correct: number | null;
  incorrect: number | null;
  durationSeconds: number | null;
  classification: Classification | null;
};

const UUID = /^[0-9a-f-]{36}$/i;

export async function buildReport(supabase: ServerSupabase, params: ReportParams) {
  const period: Period = resolvePeriod(params, "tudo");
  const ds = await loadPerformanceDataset(supabase, { from: period.from, to: period.to });
  const { settings } = ds;

  let collaborators = ds.collaborators;
  if (params.colaborador && UUID.test(params.colaborador)) collaborators = collaborators.filter((c) => c.id === params.colaborador);
  if (params.guardiao && UUID.test(params.guardiao)) collaborators = collaborators.filter((c) => c.guardianId === params.guardiao);
  const ids = new Set(collaborators.map((c) => c.id));
  const byId = new Map(collaborators.map((c) => [c.id, c]));

  const quizFilter = params.avaliacao && UUID.test(params.avaliacao) ? params.avaliacao : null;
  const noteFilter = params.nota && params.nota in CLASSIFICATIONS ? (params.nota as Classification) : null;
  const statusFilter = params.status && params.status in ASSIGNMENT_STATUS ? (params.status as AssignmentStatus) : null;
  const categoryFilter = params.categoria && UUID.test(params.categoria) ? params.categoria : null;

  let attempts = ds.attempts.filter((a) => ids.has(a.collaboratorId));
  const assignmentQuiz = new Map(ds.allAssignments.map((a) => [a.id, a.quizId]));
  if (quizFilter) attempts = attempts.filter((a) => assignmentQuiz.get(a.assignmentId) === quizFilter);
  if (noteFilter) attempts = attempts.filter((a) => classify(a.score) === noteFilter);
  const attemptIds = new Set(attempts.map((a) => a.id));
  let answers = ds.answers.filter((a) => attemptIds.has(a.attemptId));
  if (categoryFilter) answers = answers.filter((a) => a.categoryId === categoryFilter);

  const attemptBy = new Map(attempts.map((a) => [a.assignmentId, a]));
  const now = new Date();
  // Atribuições: enviadas no período, ou com resultado concluído no período.
  const rows: ReportRow[] = ds.allAssignments
    .filter((a) => ids.has(a.collaboratorId))
    .filter((a) => !quizFilter || a.quizId === quizFilter)
    .filter((a) => attemptBy.has(a.id) || ds.assignments.some((x) => x.id === a.id))
    .map((a) => {
      const t = attemptBy.get(a.id);
      const c = byId.get(a.collaboratorId)!;
      return {
        assignmentId: a.id,
        attemptId: t?.id ?? null,
        collaboratorId: a.collaboratorId,
        collaborator: c.fullName,
        guardian: c.guardianName,
        quiz: a.quizTitle,
        assignedAt: a.assignedAt,
        dueAt: a.dueAt,
        status: effectiveAssignmentStatus(a.status, a.dueAt, now),
        completedAt: t?.completedAt ?? null,
        score: t?.score ?? null,
        correct: t?.correct ?? null,
        incorrect: t?.incorrect ?? null,
        durationSeconds: t?.durationSeconds ?? null,
        classification: t ? classify(t.score) : null,
      };
    })
    .filter((r) => !noteFilter || r.classification === noteFilter)
    .filter((r) => !statusFilter || r.status === statusFilter);

  const scores = attempts.map((a) => a.score);
  const questionIds = [...new Set(answers.map((a) => a.questionId))];
  const { data: qs } = questionIds.length
    ? await supabase.from("questions").select("id, code, statement, topic").in("id", questionIds)
    : { data: [] as { id: string; code: string | null; statement: string; topic: string }[] };
  const qMap = new Map((qs ?? []).map((q) => [q.id, q]));
  const worstQuestions = questionErrorRates(answers).slice(0, 10).map((r) => ({ ...r, question: qMap.get(r.questionId) }));
  const categories = categoryPerformance(answers, ds.categories, settings.minAnswersForDiagnosis);
  const attemptsByCollab = groupBy(attempts, (a) => a.collaboratorId);
  const perCollaborator = collaborators
    .map((c) => ({ id: c.id, name: c.fullName, guardian: c.guardianName, stats: collaboratorStats(attemptsByCollab.get(c.id) ?? [], settings.passingScore) }))
    .filter((r) => r.stats.count > 0);

  return {
    period,
    settings,
    rows,
    summary: {
      average: average(scores),
      approvalRate: percentage(scores.filter((s) => s >= settings.passingScore).length, scores.length),
      completed: attempts.length,
      collaborators: new Set(attempts.map((a) => a.collaboratorId)).size,
    },
    timeline: scoreTimeline(attempts, settings.passingScore, pickGranularity(period.from, period.to, attempts)),
    categories,
    hardestCategories: categories.filter((c) => c.total > 0).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0)).slice(0, 5),
    worstQuestions,
    perCollaborator,
    options: {
      collaborators: ds.collaborators.map((c) => ({ id: c.id, name: c.fullName })),
      categories: ds.categories,
      quizzes: [...new Map(ds.allAssignments.map((a) => [a.quizId, a.quizTitle])).entries()].map(([id, title]) => ({ id, title })),
    },
  };
}

function csvCell(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Evita injeção de fórmulas em planilhas.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(rows: ReportRow[]) {
  const header = ["Colaborador", "Guardião", "Avaliação", "Enviada em", "Prazo", "Status", "Concluída em", "Nota", "Acertos", "Erros", "Classificação", "Tempo"];
  const lines = rows.map((r) =>
    [
      r.collaborator,
      r.guardian ?? "",
      r.quiz,
      formatDateTime(r.assignedAt),
      r.dueAt ? formatDateTime(r.dueAt) : "",
      ASSIGNMENT_STATUS[r.status].label,
      r.completedAt ? formatDateTime(r.completedAt) : "",
      r.score !== null ? formatScore(r.score) : "",
      r.correct ?? "",
      r.incorrect ?? "",
      r.classification ? CLASSIFICATIONS[r.classification].label : "",
      r.durationSeconds !== null ? formatDuration(r.durationSeconds) : "",
    ].map(csvCell).join(";"),
  );
  // BOM + ";" para abrir corretamente no Excel em pt-BR.
  return "﻿" + [header.join(";"), ...lines].join("\r\n");
}
