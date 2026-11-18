export type ActivityTone = "info" | "success" | "warning" | "neutral" | "danger";

export type ActivityLog = {
  id: number;
  action: string;
  createdAt: string;
  actorName: string | null;
  subjectName: string | null;
  metadata: Record<string, unknown>;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Texto legível para cada evento registrado em audit_logs. */
export function describeActivity(log: ActivityLog): { text: string; tone: ActivityTone } {
  const actor = log.actorName ?? "Sistema";
  const subject = log.subjectName ?? "colaborador";
  const title = str(log.metadata.title);
  switch (log.action) {
    case "quiz_created":
      return { text: `${actor} criou a avaliação "${title}" para ${log.metadata.collaborators ?? "?"} colaborador(es).`, tone: "info" };
    case "quiz_assigned":
      return { text: `Avaliação "${title}" enviada para ${subject}.`, tone: "info" };
    case "attempt_started":
      return { text: `${subject} iniciou a avaliação "${title}".`, tone: "info" };
    case "attempt_completed": {
      const score = typeof log.metadata.score === "number" ? log.metadata.score.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";
      const byDeadline = log.metadata.reason === "deadline";
      return { text: `${subject} concluiu uma avaliação — resultado registrado: ${score} pontos${byDeadline ? " (finalizada no prazo limite)" : ""}.`, tone: "success" };
    }
    case "assignment_expired":
      return { text: `Avaliação de ${subject} expirou sem conclusão.`, tone: "warning" };
    case "assignment_cancelled":
      return { text: `${actor} cancelou uma avaliação de ${subject}.`, tone: "neutral" };
    case "quiz_cancelled":
      return { text: `${actor} cancelou uma avaliação.`, tone: "neutral" };
    case "user_created":
      return { text: `${actor} cadastrou ${str(log.metadata.full_name) || subject}.`, tone: "info" };
    case "user_updated":
      return { text: `${actor} atualizou os dados de ${subject}.`, tone: "neutral" };
    case "user_deactivated":
      return { text: `${actor} desativou ${subject}.`, tone: "danger" };
    case "user_reactivated":
      return { text: `${actor} reativou ${subject}.`, tone: "success" };
    case "guardian_linked":
      return { text: `${actor} vinculou ${subject} a um guardião.`, tone: "info" };
    case "guardian_unlinked":
      return { text: `${actor} desvinculou ${subject} do guardião.`, tone: "neutral" };
    case "question_created":
      return { text: `${actor} criou uma nova questão no banco.`, tone: "info" };
    case "question_updated":
      return { text: `${actor} editou uma questão (versão ${log.metadata.version ?? "?"}).`, tone: "neutral" };
    case "question_activated":
      return { text: `${actor} ativou uma questão.`, tone: "neutral" };
    case "question_deactivated":
      return { text: `${actor} desativou uma questão.`, tone: "neutral" };
    case "settings_updated":
      return { text: `${actor} alterou as configurações da plataforma.`, tone: "warning" };
    default:
      return { text: `${actor}: ${log.action}`, tone: "neutral" };
  }
}

export const FEED_ACTIONS = ["quiz_assigned", "attempt_started", "attempt_completed", "user_created", "guardian_linked", "assignment_expired"];
