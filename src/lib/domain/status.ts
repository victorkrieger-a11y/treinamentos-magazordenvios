import type { Database } from "@/types/database";

export type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export const ASSIGNMENT_STATUS: Record<AssignmentStatus, { label: string; tone: Tone }> = {
  pending: { label: "Aguardando início", tone: "warning" },
  in_progress: { label: "Em andamento", tone: "info" },
  completed: { label: "Concluída", tone: "success" },
  expired: { label: "Expirada", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

/**
 * Status efetivo para exibição: atribuições abertas com prazo vencido são
 * exibidas como expiradas mesmo antes da rotina de expiração rodar.
 */
export function effectiveAssignmentStatus(
  status: AssignmentStatus,
  dueAt: string | null,
  now: Date = new Date(),
): AssignmentStatus {
  if ((status === "pending" || status === "in_progress") && dueAt && new Date(dueAt) < now) return "expired";
  return status;
}

export const DIFFICULTY_LABELS: Record<Database["public"]["Enums"]["question_difficulty"], string> = {
  facil: "Fácil",
  media: "Média",
  dificil: "Difícil",
};

export const QUIZ_MODE_LABELS: Record<Database["public"]["Enums"]["quiz_mode"], string> = {
  standard: "Padrão",
  custom: "Personalizada",
};
