/**
 * Regras de pontuação e classificação.
 *
 * A nota OFICIAL é sempre calculada no banco (função private.grade_attempt),
 * dentro da transação de finalização. Estas funções replicam a mesma fórmula
 * para exibição, testes e relatórios — nunca para gravar resultados.
 */

export const DEFAULT_PASSING_SCORE = 80;
export const DEFAULT_ATTENTION_SCORE = 70;

/** Pontuação = (acertos / questões) × 100, arredondada em 2 casas. */
export function calculateScore(correct: number, total: number): number {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return 0;
  if (correct < 0 || correct > total) throw new RangeError("Quantidade de acertos inválida.");
  return roundTo2((correct * 100) / total);
}

export function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type Classification = "excelente" | "aprovado" | "em_desenvolvimento" | "precisa_reforco";

export const CLASSIFICATIONS: Record<
  Classification,
  { label: string; min: number; tone: "success" | "info" | "warning" | "danger" }
> = {
  excelente: { label: "Excelente", min: 90, tone: "success" },
  aprovado: { label: "Aprovado", min: 80, tone: "success" },
  em_desenvolvimento: { label: "Em desenvolvimento", min: 70, tone: "warning" },
  precisa_reforco: { label: "Precisa de reforço", min: 0, tone: "danger" },
};

/** 90–100 Excelente · 80–89,99 Aprovado · 70–79,99 Em desenvolvimento · 0–69,99 Precisa de reforço */
export function classify(score: number): Classification {
  if (score >= 90) return "excelente";
  if (score >= 80) return "aprovado";
  if (score >= 70) return "em_desenvolvimento";
  return "precisa_reforco";
}

export function isApproved(score: number, passingScore: number = DEFAULT_PASSING_SCORE) {
  return score >= passingScore;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return roundTo2(values.reduce((a, b) => a + b, 0) / values.length);
}

export function percentage(part: number, total: number): number | null {
  if (total <= 0) return null;
  return roundTo2((part * 100) / total);
}
