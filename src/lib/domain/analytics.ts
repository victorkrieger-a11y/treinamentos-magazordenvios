/**
 * Análises de desempenho — funções puras e transparentes, alimentadas
 * exclusivamente por dados reais do banco (tentativas oficiais concluídas e
 * suas respostas). Avaliações canceladas nunca entram nos cálculos.
 */
import { average, isApproved, percentage, roundTo2 } from "@/lib/domain/scoring";
import { formatPercent, formatScore } from "@/lib/domain/format";
import type { AssignmentStatus } from "@/lib/domain/status";

export type CollaboratorRecord = {
  id: string;
  fullName: string;
  email: string;
  status: "invited" | "active" | "inactive";
  jobTitle: string | null;
  startedAt: string | null;
  createdAt: string;
  lastAccessAt: string | null;
  guardianId: string | null;
  guardianName: string | null;
};

export type AssignmentRecord = {
  id: string;
  quizId: string;
  quizTitle: string;
  collaboratorId: string;
  assignedBy: string;
  assignedByName: string | null;
  assignedAt: string;
  dueAt: string | null;
  status: AssignmentStatus;
  completedAt: string | null;
};

/** Tentativa oficial (melhor tentativa concluída de cada atribuição). */
export type AttemptRecord = {
  id: string;
  assignmentId: string;
  collaboratorId: string;
  quizTitle: string;
  attemptNumber: number;
  startedAt: string;
  completedAt: string;
  score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  durationSeconds: number | null;
};

export type AnswerRecord = {
  attemptId: string;
  collaboratorId: string;
  questionId: string;
  categoryId: string;
  topic: string;
  isCorrect: boolean;
};

export type CategoryRecord = { id: string; name: string; sortOrder: number };

export type Trend = "up" | "stable" | "down" | "insufficient";

export const TREND_THRESHOLD = 5;

export const TREND_LABELS: Record<Trend, string> = {
  up: "Evolução positiva",
  stable: "Estável",
  down: "Queda de desempenho",
  insufficient: "Dados insuficientes",
};

// -----------------------------------------------------------------------------
// Estatísticas individuais
// -----------------------------------------------------------------------------
export type CollaboratorStats = {
  count: number;
  average: number | null;
  lastScore: number | null;
  lastCompletedAt: string | null;
  firstScore: number | null;
  approvedCount: number;
  approvalRate: number | null;
  /** Diferença entre a última nota e a anterior. */
  delta: number | null;
  /** Diferença entre a última e a primeira nota (evolução acumulada). */
  evolution: number | null;
  trend: Trend;
};

export function sortByCompletion<T extends { completedAt: string }>(attempts: T[]): T[] {
  return [...attempts].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
}

export function trendFromDelta(delta: number | null): Trend {
  if (delta === null) return "insufficient";
  if (delta >= TREND_THRESHOLD) return "up";
  if (delta <= -TREND_THRESHOLD) return "down";
  return "stable";
}

export function collaboratorStats(attempts: AttemptRecord[], passingScore: number): CollaboratorStats {
  const sorted = sortByCompletion(attempts);
  const scores = sorted.map((a) => a.score);
  const last = sorted.at(-1) ?? null;
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const approvedCount = scores.filter((s) => isApproved(s, passingScore)).length;
  const delta = last && prev ? roundTo2(last.score - prev.score) : null;
  return {
    count: sorted.length,
    average: average(scores),
    lastScore: last?.score ?? null,
    lastCompletedAt: last?.completedAt ?? null,
    firstScore: sorted[0]?.score ?? null,
    approvedCount,
    approvalRate: percentage(approvedCount, sorted.length),
    delta,
    evolution: sorted.length >= 2 ? roundTo2(sorted.at(-1)!.score - sorted[0].score) : null,
    trend: trendFromDelta(delta),
  };
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

// -----------------------------------------------------------------------------
// Categorias e tópicos
// -----------------------------------------------------------------------------
export type CategoryPerformance = {
  categoryId: string;
  name: string;
  correct: number;
  wrong: number;
  total: number;
  rate: number | null;
  sufficient: boolean;
};

export function categoryPerformance(
  answers: AnswerRecord[],
  categories: CategoryRecord[],
  minAnswers: number,
): CategoryPerformance[] {
  const byCat = groupBy(answers, (a) => a.categoryId);
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => {
      const list = byCat.get(c.id) ?? [];
      const correct = list.filter((a) => a.isCorrect).length;
      return {
        categoryId: c.id,
        name: c.name,
        correct,
        wrong: list.length - correct,
        total: list.length,
        rate: percentage(correct, list.length),
        sufficient: list.length >= minAnswers,
      };
    });
}

export type TopicDifficulty = {
  topic: string;
  categoryId: string;
  wrong: number;
  total: number;
  errorRate: number;
  sufficient: boolean;
};

export function topicDifficulties(answers: AnswerRecord[], minAnswers: number): TopicDifficulty[] {
  const byTopic = groupBy(answers, (a) => a.topic);
  const rows: TopicDifficulty[] = [];
  for (const [topic, list] of byTopic) {
    const wrong = list.filter((a) => !a.isCorrect).length;
    if (wrong === 0) continue;
    rows.push({
      topic,
      categoryId: list[0].categoryId,
      wrong,
      total: list.length,
      errorRate: percentage(wrong, list.length) ?? 0,
      sufficient: list.length >= minAnswers,
    });
  }
  return rows.sort((a, b) => b.wrong - a.wrong || b.errorRate - a.errorRate || a.topic.localeCompare(b.topic));
}

export type QuestionErrorRate = { questionId: string; wrong: number; total: number; errorRate: number };

export function questionErrorRates(answers: AnswerRecord[]): QuestionErrorRate[] {
  const byQ = groupBy(answers, (a) => a.questionId);
  return [...byQ.entries()]
    .map(([questionId, list]) => {
      const wrong = list.filter((a) => !a.isCorrect).length;
      return { questionId, wrong, total: list.length, errorRate: percentage(wrong, list.length) ?? 0 };
    })
    .filter((r) => r.wrong > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.wrong - a.wrong);
}

// -----------------------------------------------------------------------------
// Diagnóstico e recomendações (algoritmo simples e transparente)
// -----------------------------------------------------------------------------
export type ReinforcementItem = {
  questionId: string;
  topic: string;
  studyTip: string | null;
  wrong: number;
  total: number;
};

export type Diagnosis = {
  status: "no_data" | "insufficient" | "no_difficulty" | "ok";
  mainDifficulty: string | null;
  summary: string;
  topics: string[];
  recommendations: string[];
};

function joinPt(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

/**
 * Regras:
 * 1. Sem respostas → sem diagnóstico.
 * 2. Categoria com menor aproveitamento (abaixo de 80%), considerando apenas
 *    categorias com respostas suficientes, é a "maior dificuldade".
 * 3. Tópicos com mais erros (respostas reais) são listados para reforço.
 * 4. Recomendações = orientações de estudo das questões efetivamente erradas,
 *    ordenadas pela quantidade de erros.
 */
export function buildDiagnosis(
  categoryRows: CategoryPerformance[],
  topics: TopicDifficulty[],
  reinforcement: ReinforcementItem[],
  subject: "colaborador" | "voce" | "equipe" = "colaborador",
): Diagnosis {
  const total = categoryRows.reduce((s, c) => s + c.total, 0);
  if (total === 0) {
    return {
      status: "no_data",
      mainDifficulty: null,
      summary: "Ainda não há avaliações concluídas para gerar um diagnóstico.",
      topics: [],
      recommendations: [],
    };
  }

  const recommendations = [
    ...new Set(
      [...reinforcement]
        .filter((r) => r.wrong > 0 && r.studyTip)
        .sort((a, b) => b.wrong - a.wrong)
        .map((r) => r.studyTip as string),
    ),
  ].slice(0, 6);

  const weak = categoryRows
    .filter((c) => c.sufficient && c.rate !== null && c.rate < 80)
    .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0) || b.wrong - a.wrong);
  const topTopics = topics.slice(0, 3).map((t) => t.topic);

  if (weak.length === 0) {
    const anyInsufficientErrors = categoryRows.some((c) => !c.sufficient && c.wrong > 0);
    if (topics.length === 0) {
      return {
        status: "no_difficulty",
        mainDifficulty: null,
        summary: "Nenhuma dificuldade identificada: todas as questões respondidas foram acertadas.",
        topics: [],
        recommendations: [],
      };
    }
    return {
      status: anyInsufficientErrors ? "insufficient" : "no_difficulty",
      mainDifficulty: null,
      summary: anyInsufficientErrors
        ? `Foram registrados erros em ${joinPt(topTopics)}, mas ainda não existem dados suficientes por categoria para confirmar uma dificuldade recorrente.`
        : "O aproveitamento está igual ou acima de 80% em todas as categorias com dados suficientes.",
      topics: topTopics,
      recommendations,
    };
  }

  const main = weak[0];
  const who =
    subject === "voce" ? "Você apresentou" : subject === "equipe" ? "A equipe apresentou" : "Este colaborador apresentou";
  const topicsInMain = topics.filter((t) => t.categoryId === main.categoryId).slice(0, 3).map((t) => t.topic);
  const summary =
    `${who} dificuldade em questões de ${main.name} ` +
    `(${formatPercent(main.rate)} de aproveitamento em ${main.total} respostas)` +
    (topicsInMain.length ? `, principalmente em ${joinPt(topicsInMain)}.` : ".");

  return {
    status: "ok",
    mainDifficulty: main.name,
    summary,
    topics: topTopics,
    recommendations,
  };
}

// -----------------------------------------------------------------------------
// Séries temporais
// -----------------------------------------------------------------------------
export type Granularity = "day" | "week" | "month";

export function pickGranularity(from: string | null, to: string | null, attempts: { completedAt: string }[]): Granularity {
  const start = from ? new Date(from).getTime() : Math.min(...attempts.map((a) => new Date(a.completedAt).getTime()));
  const end = to ? new Date(to).getTime() : Date.now();
  const days = Number.isFinite(start) ? (end - start) / 86400000 : 0;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

function bucketKey(iso: string, granularity: Granularity): string {
  // Agrupamento no horário de Brasília (UTC-3).
  const d = new Date(new Date(iso).getTime() - 3 * 3600000);
  if (granularity === "month") return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  if (granularity === "week") {
    const day = (d.getUTCDay() + 6) % 7; // segunda-feira = 0
    d.setUTCDate(d.getUTCDate() - day);
  }
  return d.toISOString().slice(0, 10);
}

export function bucketLabel(key: string, granularity: Granularity) {
  const [y, m, d] = key.split("-");
  if (granularity === "month") {
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    return `${months[Number(m) - 1]}/${y.slice(2)}`;
  }
  return `${d}/${m}`;
}

export type TimelinePoint = {
  key: string;
  label: string;
  average: number | null;
  completed: number;
  approvalRate: number | null;
};

export function scoreTimeline(attempts: AttemptRecord[], passingScore: number, granularity: Granularity): TimelinePoint[] {
  const groups = groupBy(attempts, (a) => bucketKey(a.completedAt, granularity));
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      const scores = list.map((a) => a.score);
      return {
        key,
        label: bucketLabel(key, granularity),
        average: average(scores),
        completed: list.length,
        approvalRate: percentage(scores.filter((s) => isApproved(s, passingScore)).length, list.length),
      };
    });
}

// -----------------------------------------------------------------------------
// Indicadores da equipe
// -----------------------------------------------------------------------------
export type TeamKpis = {
  activeCollaborators: number;
  assignmentsSent: number;
  pending: number;
  completed: number;
  average: number | null;
  approvalRate: number | null;
  needReinforcement: number;
};

const OPEN: AssignmentStatus[] = ["pending", "in_progress"];

export function isOpenAssignment(a: Pick<AssignmentRecord, "status" | "dueAt">, now = new Date()) {
  return OPEN.includes(a.status) && !(a.dueAt && new Date(a.dueAt) < now);
}

export function teamKpis(params: {
  collaborators: CollaboratorRecord[];
  assignments: AssignmentRecord[];
  attempts: AttemptRecord[];
  statsByCollaborator: Map<string, CollaboratorStats>;
  passingScore: number;
  attentionScore: number;
}): TeamKpis {
  const { collaborators, assignments, attempts, statsByCollaborator, passingScore, attentionScore } = params;
  const valid = assignments.filter((a) => a.status !== "cancelled");
  const scores = attempts.map((a) => a.score);
  return {
    activeCollaborators: collaborators.filter((c) => c.status !== "inactive").length,
    assignmentsSent: valid.length,
    pending: valid.filter((a) => isOpenAssignment(a)).length,
    completed: valid.filter((a) => a.status === "completed").length,
    average: average(scores),
    approvalRate: percentage(scores.filter((s) => isApproved(s, passingScore)).length, scores.length),
    needReinforcement: collaborators.filter((c) => {
      const s = statsByCollaborator.get(c.id);
      return c.status !== "inactive" && s?.lastScore !== null && s?.lastScore !== undefined && s.lastScore < attentionScore;
    }).length,
  };
}

// -----------------------------------------------------------------------------
// Alertas de atenção
// -----------------------------------------------------------------------------
export type AlertKind = "below_attention" | "below_passing" | "pending" | "expired" | "recurring" | "never_assessed" | "decline";

export type AttentionAlert = {
  collaboratorId: string;
  name: string;
  kind: AlertKind;
  severity: "high" | "medium" | "low";
  reason: string;
  lastAssessmentAt: string | null;
  score: number | null;
  action: string;
};

export function attentionAlerts(params: {
  collaborators: CollaboratorRecord[];
  assignments: AssignmentRecord[];
  statsByCollaborator: Map<string, CollaboratorStats>;
  answers: AnswerRecord[];
  categories: CategoryRecord[];
  passingScore: number;
  attentionScore: number;
  now?: Date;
}): AttentionAlert[] {
  const { collaborators, assignments, statsByCollaborator, answers, categories, passingScore, attentionScore } = params;
  const now = params.now ?? new Date();
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const assignmentsBy = groupBy(assignments, (a) => a.collaboratorId);
  const answersBy = groupBy(answers, (a) => a.collaboratorId);
  const alerts: AttentionAlert[] = [];

  for (const c of collaborators) {
    if (c.status === "inactive") continue;
    const s = statsByCollaborator.get(c.id);
    const base = { collaboratorId: c.id, name: c.fullName, lastAssessmentAt: s?.lastCompletedAt ?? null, score: s?.lastScore ?? null };
    const own = assignmentsBy.get(c.id) ?? [];

    if (!s || s.count === 0) {
      if (own.filter((a) => a.status !== "cancelled").length === 0) {
        alerts.push({ ...base, kind: "never_assessed", severity: "medium", reason: "Ainda não realizou nenhuma avaliação.", action: "Enviar a avaliação padrão para estabelecer uma linha de base." });
      }
    } else if (s.lastScore !== null && s.lastScore < attentionScore) {
      alerts.push({ ...base, kind: "below_attention", severity: "high", reason: `Última nota abaixo de ${formatScore(attentionScore)}.`, action: "Planejar reforço com o guardião nos assuntos com erro e reaplicar a avaliação." });
    } else if (s.lastScore !== null && s.lastScore < passingScore) {
      alerts.push({ ...base, kind: "below_passing", severity: "medium", reason: `Última nota abaixo da meta de aprovação (${formatScore(passingScore)}).`, action: "Revisar as questões erradas com o colaborador e reaplicar a avaliação." });
    }

    if (s && s.trend === "down" && s.delta !== null) {
      alerts.push({ ...base, kind: "decline", severity: "medium", reason: `Queda de desempenho (${formatScore(s.delta)} pontos em relação à avaliação anterior).`, action: "Conversar com o colaborador e revisar os erros das últimas avaliações." });
    }

    const open = own.filter((a) => isOpenAssignment(a, now));
    if (open.length > 0) {
      const nextDue = open.map((a) => a.dueAt).filter(Boolean).sort()[0] ?? null;
      alerts.push({ ...base, kind: "pending", severity: "low", reason: `${open.length} avaliação(ões) pendente(s)${nextDue ? " com prazo em aberto" : ""}.`, action: "Acompanhar a conclusão dentro do prazo." });
    }
    const expired = own.filter((a) => a.status === "expired" || (OPEN.includes(a.status) && a.dueAt && new Date(a.dueAt) < now));
    if (expired.length > 0) {
      alerts.push({ ...base, kind: "expired", severity: "medium", reason: `${expired.length} avaliação(ões) expirada(s) sem conclusão.`, action: "Verificar o motivo e reenviar a avaliação com novo prazo." });
    }

    // Dificuldade recorrente: erros na mesma categoria em pelo menos duas
    // avaliações diferentes e aproveitamento abaixo de 60% na categoria.
    const own_answers = answersBy.get(c.id) ?? [];
    for (const [categoryId, list] of groupBy(own_answers, (a) => a.categoryId)) {
      const wrong = list.filter((a) => !a.isCorrect);
      const attemptsWithErrors = new Set(wrong.map((a) => a.attemptId)).size;
      const rate = percentage(list.length - wrong.length, list.length) ?? 100;
      if (attemptsWithErrors >= 2 && rate < 60) {
        alerts.push({ ...base, kind: "recurring", severity: "high", reason: `Dificuldade recorrente em ${catName.get(categoryId) ?? "uma categoria"} (${formatPercent(rate)} de aproveitamento).`, action: `Reforçar o conteúdo de ${catName.get(categoryId) ?? "categoria"} e aplicar uma avaliação personalizada.` });
      }
    }
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity] || a.name.localeCompare(b.name));
}

// -----------------------------------------------------------------------------
// Ranking administrativo
// -----------------------------------------------------------------------------
export type RankingRow = {
  collaboratorId: string;
  name: string;
  guardianName: string | null;
  status: CollaboratorRecord["status"];
  average: number | null;
  lastScore: number | null;
  count: number;
  evolution: number | null;
  trend: Trend;
  situation: "excelente" | "aprovado" | "em_desenvolvimento" | "precisa_reforco" | "sem_avaliacao";
};

export function rankingRows(
  collaborators: CollaboratorRecord[],
  statsByCollaborator: Map<string, CollaboratorStats>,
): RankingRow[] {
  return collaborators.map((c) => {
    const s = statsByCollaborator.get(c.id);
    const avg = s?.average ?? null;
    let situation: RankingRow["situation"] = "sem_avaliacao";
    if (avg !== null) {
      situation = avg >= 90 ? "excelente" : avg >= 80 ? "aprovado" : avg >= 70 ? "em_desenvolvimento" : "precisa_reforco";
    }
    return {
      collaboratorId: c.id,
      name: c.fullName,
      guardianName: c.guardianName,
      status: c.status,
      average: avg,
      lastScore: s?.lastScore ?? null,
      count: s?.count ?? 0,
      evolution: s?.evolution ?? null,
      trend: s?.trend ?? "insufficient",
      situation,
    };
  });
}
