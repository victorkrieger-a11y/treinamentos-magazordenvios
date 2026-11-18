import { describe, expect, it } from "vitest";
import {
  attentionAlerts,
  buildDiagnosis,
  categoryPerformance,
  collaboratorStats,
  questionErrorRates,
  rankingRows,
  scoreTimeline,
  teamKpis,
  topicDifficulties,
  type AnswerRecord,
  type AssignmentRecord,
  type AttemptRecord,
  type CategoryRecord,
  type CollaboratorRecord,
} from "@/lib/domain/analytics";

const categories: CategoryRecord[] = [
  { id: "atend", name: "Atendimento", sortOrder: 1 },
  { id: "rast", name: "Rastreamento", sortOrder: 2 },
  { id: "ocor", name: "Ocorrências", sortOrder: 3 },
  { id: "prazos", name: "Prazos", sortOrder: 4 },
];

function attempt(id: string, collaboratorId: string, score: number, completedAt: string, title = "Avaliação"): AttemptRecord {
  return { id, assignmentId: `as-${id}`, collaboratorId, quizTitle: title, attemptNumber: 1, startedAt: completedAt, completedAt, score, correct: 0, incorrect: 0, unanswered: 0, total: 30, durationSeconds: 600 };
}

function answers(attemptId: string, collaboratorId: string, categoryId: string, topic: string, correct: number, wrong: number, q = topic): AnswerRecord[] {
  return [
    ...Array.from({ length: correct }, (_, i) => ({ attemptId, collaboratorId, questionId: `${q}-c${i}`, categoryId, topic, isCorrect: true })),
    ...Array.from({ length: wrong }, (_, i) => ({ attemptId, collaboratorId, questionId: `${q}-w${i}`, categoryId, topic, isCorrect: false })),
  ];
}

const collab = (id: string, name: string, extra: Partial<CollaboratorRecord> = {}): CollaboratorRecord => ({
  id, fullName: name, email: `${id}@x.com`, status: "active", jobTitle: null, startedAt: null, createdAt: "2026-01-01T00:00:00Z", lastAccessAt: null, guardianId: null, guardianName: null, ...extra,
});

describe("collaboratorStats — evolução individual", () => {
  it("identifica evolução positiva (exemplo do treinamento)", () => {
    const s = collaboratorStats(
      [attempt("3", "c", 90, "2026-03-01T10:00:00Z"), attempt("1", "c", 63.33, "2026-01-01T10:00:00Z"), attempt("2", "c", 76.67, "2026-02-01T10:00:00Z")],
      80,
    );
    expect(s.count).toBe(3);
    expect(s.average).toBe(76.67);
    expect(s.lastScore).toBe(90);
    expect(s.delta).toBe(13.33);
    expect(s.evolution).toBe(26.67);
    expect(s.trend).toBe("up");
    expect(s.approvalRate).toBe(33.33);
  });

  it("identifica estabilidade e queda", () => {
    expect(collaboratorStats([attempt("1", "c", 80, "2026-01-01T00:00:00Z"), attempt("2", "c", 82, "2026-01-02T00:00:00Z")], 80).trend).toBe("stable");
    expect(collaboratorStats([attempt("1", "c", 90, "2026-01-01T00:00:00Z"), attempt("2", "c", 70, "2026-01-02T00:00:00Z")], 80).trend).toBe("down");
    expect(collaboratorStats([attempt("1", "c", 90, "2026-01-01T00:00:00Z")], 80).trend).toBe("insufficient");
    expect(collaboratorStats([], 80)).toMatchObject({ count: 0, average: null, approvalRate: null });
  });
});

describe("categoryPerformance", () => {
  it("calcula acertos, erros e aproveitamento a partir das respostas reais", () => {
    const rows = categoryPerformance(
      [...answers("a", "c", "atend", "Atendimento", 4, 1), ...answers("a", "c", "rast", "Rastreamento", 3, 2), ...answers("a", "c", "ocor", "Ocorrências", 5, 2)],
      categories,
      2,
    );
    expect(rows.map((r) => [r.name, r.correct, r.wrong, r.rate])).toEqual([
      ["Atendimento", 4, 1, 80],
      ["Rastreamento", 3, 2, 60],
      ["Ocorrências", 5, 2, 71.43],
      ["Prazos", 0, 0, null],
    ]);
    expect(rows[3].sufficient).toBe(false);
  });
});

describe("diagnóstico e recomendações", () => {
  it("aponta a maior dificuldade e recomenda com base nas questões erradas", () => {
    const ans = [
      ...answers("a", "c", "prazos", "Acareação e prazos", 1, 3, "acar"),
      ...answers("a", "c", "ocor", "Troca de etiqueta", 4, 1, "troca"),
      ...answers("a", "c", "atend", "Atendimento", 5, 0),
    ];
    const cats = categoryPerformance(ans, categories, 2);
    const topics = topicDifficulties(ans, 2);
    const d = buildDiagnosis(cats, topics, [
      { questionId: "acar-w0", topic: "Acareação e prazos", studyTip: "Memorizar o prazo de solicitação de acareação.", wrong: 3, total: 4 },
      { questionId: "troca-w0", topic: "Troca de etiqueta", studyTip: "Revisar a tratativa de troca de etiqueta.", wrong: 1, total: 5 },
    ]);
    expect(d.status).toBe("ok");
    expect(d.mainDifficulty).toBe("Prazos");
    expect(d.summary).toContain("Este colaborador apresentou dificuldade em questões de Prazos");
    expect(d.summary).toContain("Acareação e prazos");
    expect(d.topics[0]).toBe("Acareação e prazos");
    expect(d.recommendations).toEqual(["Memorizar o prazo de solicitação de acareação.", "Revisar a tratativa de troca de etiqueta."]);
  });

  it("não inventa diagnóstico quando os dados são insuficientes", () => {
    const ans = answers("a", "c", "prazos", "Prazos", 0, 1);
    const d = buildDiagnosis(categoryPerformance(ans, categories, 3), topicDifficulties(ans, 3), []);
    expect(d.status).toBe("insufficient");
    expect(d.mainDifficulty).toBeNull();
    expect(d.summary).toContain("não existem dados suficientes");
  });

  it("sem respostas → sem diagnóstico; sem erros → nenhuma dificuldade", () => {
    expect(buildDiagnosis(categoryPerformance([], categories, 2), [], []).status).toBe("no_data");
    const ok = answers("a", "c", "atend", "Atendimento", 5, 0);
    expect(buildDiagnosis(categoryPerformance(ok, categories, 2), topicDifficulties(ok, 2), []).status).toBe("no_difficulty");
  });

  it("questões com maior índice de erro", () => {
    const ans: AnswerRecord[] = [
      { attemptId: "1", collaboratorId: "a", questionId: "q1", categoryId: "x", topic: "t", isCorrect: false },
      { attemptId: "2", collaboratorId: "b", questionId: "q1", categoryId: "x", topic: "t", isCorrect: false },
      { attemptId: "1", collaboratorId: "a", questionId: "q2", categoryId: "x", topic: "t", isCorrect: false },
      { attemptId: "2", collaboratorId: "b", questionId: "q2", categoryId: "x", topic: "t", isCorrect: true },
      { attemptId: "1", collaboratorId: "a", questionId: "q3", categoryId: "x", topic: "t", isCorrect: true },
    ];
    expect(questionErrorRates(ans).map((r) => [r.questionId, r.errorRate])).toEqual([["q1", 100], ["q2", 50]]);
  });
});

describe("indicadores, alertas e ranking", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const collaborators = [collab("ana", "Ana"), collab("bia", "Bia"), collab("caio", "Caio"), collab("davi", "Davi", { status: "inactive" }), collab("eva", "Eva")];
  const attempts = [
    attempt("1", "ana", 63.33, "2026-06-01T10:00:00Z"),
    attempt("2", "bia", 90, "2026-05-01T10:00:00Z"),
    attempt("3", "bia", 75, "2026-06-01T10:00:00Z"),
    attempt("4", "caio", 100, "2026-06-01T10:00:00Z"),
  ];
  const assignments: AssignmentRecord[] = [
    { id: "p1", quizId: "q", quizTitle: "Q", collaboratorId: "caio", assignedBy: "s", assignedByName: "S", assignedAt: "2026-06-05T00:00:00Z", dueAt: "2026-06-20T00:00:00Z", status: "pending", completedAt: null },
    { id: "x1", quizId: "q", quizTitle: "Q", collaboratorId: "caio", assignedBy: "s", assignedByName: "S", assignedAt: "2026-06-01T00:00:00Z", dueAt: "2026-06-05T00:00:00Z", status: "pending", completedAt: null },
    { id: "c1", quizId: "q", quizTitle: "Q", collaboratorId: "ana", assignedBy: "s", assignedByName: "S", assignedAt: "2026-06-01T00:00:00Z", dueAt: null, status: "cancelled", completedAt: null },
  ];
  const stats = new Map(collaborators.map((c) => [c.id, collaboratorStats(attempts.filter((a) => a.collaboratorId === c.id), 80)]));
  const ans = [...answers("1", "ana", "prazos", "Prazos", 0, 2), ...answers("1b", "ana", "prazos", "Prazos", 1, 2, "p2")];

  it("gera alertas com motivo, nota e ação recomendada", () => {
    const alerts = attentionAlerts({ collaborators, assignments, statsByCollaborator: stats, answers: ans, categories, passingScore: 80, attentionScore: 70, now });
    const kinds = (id: string) => alerts.filter((a) => a.collaboratorId === id).map((a) => a.kind).sort();
    expect(kinds("ana")).toEqual(["below_attention", "recurring"]);
    expect(kinds("bia")).toEqual(["below_passing", "decline"]);
    expect(kinds("caio")).toEqual(["expired", "pending"]);
    expect(kinds("eva")).toEqual(["never_assessed"]);
    expect(kinds("davi")).toEqual([]);
    const ana = alerts.find((a) => a.kind === "below_attention")!;
    expect(ana).toMatchObject({ name: "Ana", score: 63.33 });
    expect(ana.action.length).toBeGreaterThan(10);
    expect(alerts[0].severity).toBe("high");
  });

  it("KPIs da equipe ignoram canceladas e inativos", () => {
    const k = teamKpis({ collaborators, assignments, attempts, statsByCollaborator: stats, passingScore: 80, attentionScore: 70 });
    expect(k.activeCollaborators).toBe(4);
    expect(k.assignmentsSent).toBe(2);
    expect(k.average).toBe(82.08);
    expect(k.approvalRate).toBe(50);
    expect(k.needReinforcement).toBe(1);
  });

  it("ranking com situação pela média", () => {
    const rows = rankingRows(collaborators, stats);
    expect(rows.find((r) => r.collaboratorId === "caio")!.situation).toBe("excelente");
    expect(rows.find((r) => r.collaboratorId === "bia")).toMatchObject({ average: 82.5, situation: "aprovado", trend: "down" });
    expect(rows.find((r) => r.collaboratorId === "eva")!.situation).toBe("sem_avaliacao");
  });

  it("série temporal agrupa por dia no horário de Brasília", () => {
    const t = scoreTimeline([attempt("a", "x", 80, "2026-06-01T02:00:00Z"), attempt("b", "x", 60, "2026-06-01T04:00:00Z")], 80, "day");
    expect(t.map((p) => [p.label, p.average, p.completed, p.approvalRate])).toEqual([["31/05", 80, 1, 100], ["01/06", 60, 1, 0]]);
  });
});
